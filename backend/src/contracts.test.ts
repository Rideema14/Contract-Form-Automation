
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractStatus, Prisma, UserRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from './lib/prisma';
import {
  bidderSchema,
  contractDraftSchema,
  contractListQuerySchema,
} from './schemas/contract.schema';
import {
  createDraft,
  createBidder,
  getCostEstimate,
  getContract,
  listContracts,
  deleteContract,
  deleteBidder,
  submitContract,
  updateBidder,
  updateQuotation,
  updateContract,
  assertCanDeleteAttachments,
} from './services/contract.service';
import { initializeOrResetApprovalWorkflow } from './services/approval.service';
import * as contractService from './services/contract.service';
import * as documentsRuntime from './modules/documents/documents.runtime';
import { deleteContract as deleteContractHandler } from './controllers/contracts.controller';

vi.mock('./services/approval.service', () => ({
  initializeOrResetApprovalWorkflow: vi.fn(),
}));

const submitter = { id: 'user-1', role: UserRole.SUBMITTER };
const admin = { id: 'admin-1', role: UserRole.ADMIN };
const approver = { id: 'approver-1', role: UserRole.APPROVER };

const testApproverIds = [
  '550e8400-e29b-41d4-a716-446655440002',
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('contract request validation', () => {
  it('accepts a partial draft with Decimal money as a string', () => {
    const result = contractDraftSchema.safeParse({
      title: 'Draft',
      contractAmount: '12500.2500',
      budgetProvision: '14000.0000',
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown mutation fields and invalid money', () => {
    expect(contractDraftSchema.safeParse({ status: 'APPROVED' }).success).toBe(false);
    expect(contractDraftSchema.safeParse({ contractAmount: '-1' }).success).toBe(false);
    expect(contractDraftSchema.safeParse({ budgetProvision: '-1' }).success).toBe(false);
  });

  it('applies list defaults and rejects invalid bidder ordering', () => {
    expect(contractListQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
    });

    expect(
      bidderSchema.safeParse({
        vendorId: 'not-a-uuid',
        sortOrder: -1,
      }).success,
    ).toBe(false);
  });
});

describe('contract deletion authorization', () => {
  function mockDeletionTransaction(form: {
    id: string;
    createdById: string;
    status: ContractStatus;
    referenceNo: string;
    title: string;
  } | null) {
    const auditUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const auditCreate = vi.fn().mockResolvedValue({ id: 'audit-delete' });
    const contractDelete = vi.fn().mockResolvedValue({ id: 'form-1' });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      contractForm: {
        findUnique: vi.fn().mockResolvedValue(form),
        updateMany,
        delete: contractDelete,
      },
      bidder: {
        findMany: vi.fn().mockResolvedValue([]),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      quotation: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      evaluation: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      approvalDecision: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      approvalStep: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      attachment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      costLine: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      auditLog: {
        updateMany: auditUpdateMany,
        create: auditCreate,
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) => callback(tx as never) as never,
    );
    return { tx, auditUpdateMany, auditCreate, contractDelete, updateMany };
  }

  const draft = (overrides: Partial<{
    id: string;
    createdById: string;
    status: ContractStatus;
    referenceNo: string;
    title: string;
  }> = {}) => ({
    id: 'form-1',
    createdById: submitter.id,
    status: ContractStatus.DRAFT,
    referenceNo: 'CF-0001',
    title: 'Draft project',
    ...overrides,
  });

  it('allows a Submitter to delete their own draft and records the audit event', async () => {
    const mocks = mockDeletionTransaction(draft());

    await deleteContract('form-1', submitter, 'Duplicate draft record');

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'form-1',
        status: ContractStatus.DRAFT,
        createdById: submitter.id,
      },
      data: { recommendedBidderId: null, recommendedVendorId: null },
    });
    expect(mocks.contractDelete).toHaveBeenCalledWith({ where: { id: 'form-1' } });
    expect(mocks.auditUpdateMany).toHaveBeenCalledWith({
      where: { contractFormId: 'form-1' },
      data: { contractFormId: null },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: submitter.id,
        action: 'CONTRACT_DELETED',
        entityId: 'form-1',
        details: expect.objectContaining({ reason: 'Duplicate draft record' }),
      }),
    });
  });

  it('rejects a Submitter deleting another user’s draft', async () => {
    const mocks = mockDeletionTransaction(draft({ createdById: 'another-user' }));

    await expect(
      deleteContract('form-1', submitter, 'Unauthorized deletion'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.contractDelete).not.toHaveBeenCalled();
  });

  it.each([
    ContractStatus.APPROVED,
    ContractStatus.PENDING_APPROVAL,
    ContractStatus.RETURNED,
    ContractStatus.REJECTED,
  ])('rejects a Submitter deleting a %s contract', async (status) => {
    const mocks = mockDeletionTransaction(draft({ status }));

    await expect(
      deleteContract('form-1', submitter, 'Unauthorized deletion'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('allows an Admin to delete a draft and rejects an Admin deleting a non-draft', async () => {
    const successMocks = mockDeletionTransaction(draft());

    await deleteContract('form-1', admin, 'Duplicate draft record');
    expect(successMocks.contractDelete).toHaveBeenCalledWith({ where: { id: 'form-1' } });

    vi.restoreAllMocks();
    const deniedMocks = mockDeletionTransaction(draft({ status: ContractStatus.APPROVED }));
    await expect(
      deleteContract('form-1', admin, 'Approved record cleanup'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(deniedMocks.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an Approver deleting a draft', async () => {
    const transaction = vi.spyOn(prisma, '$transaction');

    await expect(
      deleteContract('form-1', approver, 'Unauthorized deletion'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe('attachment deletion authorization', () => {
  it('allows the creator to delete attachments only while the contract is editable', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);

    await expect(assertCanDeleteAttachments('form-1', submitter)).resolves.toBeUndefined();
  });

  it('allows Admins to delete attachments on non-editable contracts', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.APPROVED,
    } as never);

    await expect(assertCanDeleteAttachments('form-1', admin)).resolves.toBeUndefined();
  });

  it('denies non-creators and creators whose contracts are no longer editable', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.PENDING_APPROVAL,
    } as never);

    await expect(assertCanDeleteAttachments('form-1', submitter)).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATE',
    });
    await expect(assertCanDeleteAttachments('form-1', approver)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('rejects deletion for a missing contract', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue(null);

    await expect(assertCanDeleteAttachments('missing-form', submitter)).rejects.toMatchObject({
      statusCode: 404,
      code: 'FORM_NOT_FOUND',
    });
  });

  it('records attachment deletions in the contract audit history', async () => {
    const create = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-1' } as never);

    await contractService.recordAttachmentDeletion({
      formId: 'form-1',
      attachmentId: 'attachment-1',
      actorId: admin.id,
      category: 'SUPPORTING',
      fileName: 'supporting.pdf',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        actorId: admin.id,
        action: 'ATTACHMENT_DELETED',
        entityType: 'Attachment',
        entityId: 'attachment-1',
        contractFormId: 'form-1',
        details: { category: 'SUPPORTING', fileName: 'supporting.pdf' },
      },
    });
  });
});

describe('contract deletion endpoint authorization', () => {
  const formId = '550e8400-e29b-41d4-a716-446655440001';
  const validBody = {
    reason: 'Duplicate draft record',
    confirm: true as const,
  };

  function context(authUser: unknown, body: Record<string, unknown> = validBody, id = formId) {
    return {
      req: {
        requestId: 'delete-test',
        params: { id },
        body,
        authUser,
      } as unknown as Request,
      res: {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as unknown as Response,
      next: vi.fn() as NextFunction,
    };
  }

  it('rejects direct API requests that violate ownership, role, or draft status', async () => {
    const cases = [
      { user: submitter, form: { ...draftForEndpoint(), createdById: 'another-user' } },
      { user: submitter, form: { ...draftForEndpoint(), status: ContractStatus.APPROVED } },
      { user: submitter, form: { ...draftForEndpoint(), status: ContractStatus.PENDING_APPROVAL } },
      { user: admin, form: { ...draftForEndpoint(), status: ContractStatus.REJECTED } },
      { user: approver, form: draftForEndpoint() },
    ];
    const findUnique = vi.spyOn(prisma.contractForm, 'findUnique');
    for (const testCase of cases.slice(0, 4)) {
      findUnique.mockResolvedValueOnce(testCase.form as never);
    }
    const cleanup = vi.spyOn(documentsRuntime, 'deleteContractAttachments');
    const remove = vi.spyOn(contractService, 'deleteContract');

    for (const testCase of cases) {
      const request = context(testCase.user, validBody, formId);
      await deleteContractHandler(request.req, request.res, request.next);
      expect(request.next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403, code: 'FORBIDDEN' }),
      );
    }

    expect(cleanup).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('allows an owned Submitter draft through the endpoint and preserves Drive-first cleanup', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue(
      draftForEndpoint() as never,
    );
    const cleanup = vi.spyOn(documentsRuntime, 'deleteContractAttachments').mockResolvedValue();
    const remove = vi.spyOn(contractService, 'deleteContract').mockResolvedValue({ id: formId } as never);
    const request = context(submitter);

    await deleteContractHandler(request.req, request.res, request.next);

    expect(cleanup).toHaveBeenCalledWith(formId);
    expect(remove).toHaveBeenCalledWith(formId, submitter, validBody.reason);
    expect(cleanup.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
    expect(request.next).not.toHaveBeenCalled();
    expect(request.res.status).toHaveBeenCalledWith(200);
  });

  it('requires a valid reason and confirmation before checking deletion eligibility', async () => {
    const request = context(admin, { reason: 'short', confirm: true });
    const findUnique = vi.spyOn(prisma.contractForm, 'findUnique');
    const cleanup = vi.spyOn(documentsRuntime, 'deleteContractAttachments');

    await deleteContractHandler(request.req, request.res, request.next);

    expect(request.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(findUnique).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('does not delete database records when Drive cleanup fails', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue(
      draftForEndpoint() as never,
    );
    vi.spyOn(documentsRuntime, 'deleteContractAttachments').mockRejectedValue(
      new Error('Drive unavailable'),
    );
    const remove = vi.spyOn(contractService, 'deleteContract');
    const request = context(submitter);

    await deleteContractHandler(request.req, request.res, request.next);

    expect(remove).not.toHaveBeenCalled();
    expect(request.next).toHaveBeenCalledWith(expect.any(Error));
  });
});

function draftForEndpoint() {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    createdById: submitter.id,
    status: ContractStatus.DRAFT,
    referenceNo: 'CF-0001',
    title: 'Draft project',
  };
}

describe('contract service authorization and persistence', () => {
  const completeForm = {
    id: 'form-1',
    formSchemaVersionId: 'legacy-v1',
    dynamicValues: {},
    formSchemaVersion: { id: 'legacy-v1', version: 1, definition: { sections: [] } },
    createdById: submitter.id,
    status: ContractStatus.DRAFT,
    title: 'Project',
    sponsorDepartmentId: 'department-1',
    contractCategoryId: 'category-1',
    scope: 'Scope',
    procurementRationale: 'Rationale',
    contractAmount: new Prisma.Decimal('30.00'),
    recommendedVendorId: null,
    selectionRationale: null,
    bidders: [{
      id: 'bidder-1',
      quotations: [{ quotedAmount: new Prisma.Decimal('30.00') }],
    }],
    evaluations: [
      { bidderId: 'bidder-1', type: 'TECHNICAL', score: new Prisma.Decimal('1'), remarks: 'Pass' },
      { bidderId: 'bidder-1', type: 'COMMERCIAL', score: new Prisma.Decimal('1'), remarks: 'Pass' },
    ],
    costLines: [{
      id: 'line-1',
      amount: new Prisma.Decimal('30.00'),
      quantity: new Prisma.Decimal('2.00'),
      unitCost: new Prisma.Decimal('15.00'),
    }],
  };


  it('rejects a submission with missing required fields', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
      title: null,
    } as never);

    await expect(
      submitContract('form-1', submitter, testApproverIds),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects a duplicate submission after the form leaves an editable state', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.PENDING_APPROVAL,
    } as never);

    await expect(
      submitContract('form-1', submitter, testApproverIds),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATE',
    });
  });

  it('rejects submission by a non-owner', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: 'other-user',
      status: ContractStatus.DRAFT,
    } as never);

    await expect(
      submitContract('form-1', submitter, testApproverIds),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('calculates decimal-safe cost totals without a tax assumption', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);

    vi.spyOn(prisma.costLine, 'findMany').mockResolvedValue([
      { amount: new Prisma.Decimal('0.10') },
      { amount: new Prisma.Decimal('0.20') },
    ] as never);

    await expect(getCostEstimate('form-1', submitter)).resolves.toMatchObject({
      subtotal: new Prisma.Decimal('0.30'),
      tax: new Prisma.Decimal('0'),
      total: new Prisma.Decimal('0.30'),
    });
  });

  it('creates a draft owned by the authenticated user', async () => {
    vi.spyOn(prisma.formSchemaVersion, 'findFirst').mockResolvedValue({
      id: 'schema-v2',
      version: 2,
      definition: { sections: [] },
      publishedAt: new Date(),
    } as never);
    const create = vi.fn().mockResolvedValue({
      id: 'form-1',
      status: ContractStatus.DRAFT,
      createdById: submitter.id,
    });
    const year = new Date().getUTCFullYear();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      contractForm: {
        findMany: vi.fn().mockResolvedValue([{ referenceNo: `CF-${year}-0003` }]),
        create,
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) => callback(tx as never) as never,
    );

    await createDraft(submitter, {
      title: 'Draft',
      contractAmount: '10.25',
      budgetProvision: '15.50',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: submitter.id,
          status: ContractStatus.DRAFT,
          formSchemaVersionId: 'schema-v2',
          dynamicValues: {},
          contractAmount: new Prisma.Decimal('10.25'),
          budgetProvision: new Prisma.Decimal('15.50'),
          referenceNo: `CF-${year}-0004`,
        }),
      }),
    );
  });

  it('stores the reference type on a new contract-only company bidder', async () => {
    const vendorTypeId = '550e8400-e29b-41d4-a716-446655440003';
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);
    vi.spyOn(prisma.bidder, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.vendorType, 'findUnique').mockResolvedValue({
      id: vendorTypeId,
      name: 'Consultant',
    } as never);
    const create = vi.fn().mockResolvedValue({ id: 'bidder-1' });
    const tx = {
      bidder: {
        aggregate: vi.fn().mockResolvedValue({ _max: { sortOrder: null } }),
        create,
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) => callback(tx as never) as never,
    );

    await createBidder('form-1', submitter, {
      companyName: 'New Consulting Co.',
      vendorId: null,
      vendorTypeId,
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        companyName: 'New Consulting Co.',
        vendorId: null,
        vendorTypeId,
      }),
      include: expect.objectContaining({
        vendorType: true,
        vendor: { include: { vendorType: true } },
      }),
    }));
  });

  it('rejects a stale published version when creating a contract', async () => {
    vi.spyOn(prisma.formSchemaVersion, 'findFirst').mockResolvedValue({
      id: 'schema-v3',
      version: 3,
      definition: { sections: [] },
      publishedAt: new Date(),
    } as never);
    const create = vi.spyOn(prisma.contractForm, 'create');

    await expect(createDraft(submitter, {
      formSchemaVersionId: 'schema-v2',
      title: 'Draft',
    })).rejects.toMatchObject({ statusCode: 409, code: 'FORM_SCHEMA_CHANGED' });
    expect(create).not.toHaveBeenCalled();
  });

  it('lists only the submitter-owned records', async () => {
    const findMany = vi.spyOn(prisma.contractForm, 'findMany')
      .mockResolvedValue([] as never);

    const count = vi.spyOn(prisma.contractForm, 'count').mockResolvedValue(0);

    const transaction = vi.spyOn(prisma, '$transaction').mockResolvedValue([
      [{ id: 'form-1' }],
      1,
    ] as never);

    await listContracts(submitter, { page: 1, pageSize: 20 });

    expect(transaction).toHaveBeenCalled();
    expect(transaction.mock.calls[0][0]).toBeInstanceOf(Array);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdById: submitter.id },
      }),
    );

    expect(count).toHaveBeenCalled();
  });

  it('combines register search, department, status, and submitted-date filters', async () => {
    const findMany = vi.spyOn(prisma.contractForm, 'findMany')
      .mockResolvedValue([] as never);

    vi.spyOn(prisma.contractForm, 'count').mockResolvedValue(0);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([[], 0] as never);

    const from = new Date('2026-03-01T00:00:00.000Z');
    const to = new Date('2026-03-31T23:59:59.999Z');
    await listContracts(admin, {
      page: 1,
      pageSize: 6,
      status: ContractStatus.APPROVED,
      departmentId: 'department-1',
      from,
      to,
      q: 'Acme',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ContractStatus.APPROVED,
          sponsorDepartmentId: 'department-1',
          submittedAt: { gte: from, lte: to },
          OR: [
            { id: { contains: 'Acme', mode: 'insensitive' } },
            { title: { contains: 'Acme', mode: 'insensitive' } },
            { referenceNo: { contains: 'Acme', mode: 'insensitive' } },
            {
              recommendedVendor: {
                is: { name: { contains: 'Acme', mode: 'insensitive' } },
              },
            },
          ],
        },
        include: expect.objectContaining({
          attachments: {
            where: { category: 'GENERATED_PDF', mimeType: 'application/pdf' },
            select: { id: true, category: true, fileName: true, mimeType: true },
          },
        }),
      }),
    );
  });

  it('lists assigned contracts for approvers', async () => {
    const findMany = vi.spyOn(prisma.contractForm, 'findMany')
      .mockResolvedValue([] as never);

    vi.spyOn(prisma.contractForm, 'count').mockResolvedValue(0);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([[], 0] as never);

    await listContracts(approver, { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          approvalSteps: {
            some: { approverId: approver.id },
          },
        },
      }),
    );
  });

  it('lists all contracts for administrators', async () => {
    const findMany = vi.spyOn(prisma.contractForm, 'findMany')
      .mockResolvedValue([] as never);

    vi.spyOn(prisma.contractForm, 'count').mockResolvedValue(0);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([[], 0] as never);

    await listContracts(admin, { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('denies a submitter access to another user contract', async () => {
    const findUnique = vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: 'other-user',
      status: ContractStatus.DRAFT,
    } as never);

    const approvalLookup = vi.spyOn(prisma.approvalStep, 'findFirst').mockResolvedValue(null);

    await expect(getContract('form-1', submitter)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    approvalLookup.mockRestore();
    findUnique.mockRestore();
  });

  it('allows an assigned approver to view a contract', async () => {
    const findUnique = vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: 'other-user',
      status: ContractStatus.PENDING_APPROVAL,
    } as never);

    const approvalLookup = vi.spyOn(prisma.approvalStep, 'findFirst').mockResolvedValue({
      id: 'step-1',
      contractFormId: 'form-1',
      approverId: approver.id,
    } as never);

    const detail = vi.spyOn(prisma.contractForm, 'findUniqueOrThrow').mockResolvedValue({
      id: 'form-1',
    } as never);

    await expect(getContract('form-1', approver)).resolves.toEqual({
      id: 'form-1',
    });

    detail.mockRestore();
    approvalLookup.mockRestore();
    findUnique.mockRestore();
  });

  it('denies a submitter assigned to an approval step', async () => {
    const findUnique = vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: 'other-user',
      status: ContractStatus.PENDING_APPROVAL,
    } as never);

    const approvalLookup = vi.spyOn(prisma.approvalStep, 'findFirst').mockResolvedValue({
      id: 'step-1',
      contractFormId: 'form-1',
      approverId: submitter.id,
    } as never);

    await expect(getContract('form-1', submitter)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    approvalLookup.mockRestore();
    findUnique.mockRestore();
  });

  it("denies an unassigned approver access to another user's contract", async () => {
    const findUnique = vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: 'other-user',
      status: ContractStatus.PENDING_APPROVAL,
    } as never);

    const approvalLookup = vi.spyOn(prisma.approvalStep, 'findFirst').mockResolvedValue(null);

    await expect(getContract('form-1', approver)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    approvalLookup.mockRestore();
    findUnique.mockRestore();
  });

  it('allows the contract owner to view their own contract', async () => {
    const findUnique = vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);

    const detail = vi.spyOn(prisma.contractForm, 'findUniqueOrThrow').mockResolvedValue({
      id: 'form-1',
    } as never);

    await expect(getContract('form-1', submitter)).resolves.toEqual({
      id: 'form-1',
    });

    detail.mockRestore();
    findUnique.mockRestore();
  });

  it('returns ordered approval steps and decisions with approver names for contract details', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.PENDING_APPROVAL,
    } as never);

    const detail = vi.spyOn(prisma.contractForm, 'findUniqueOrThrow').mockResolvedValue({
      id: 'form-1',
      approvalSteps: [
        { level: 1, status: 'APPROVED', approver: { fullName: 'Bob Approver 1' } },
        { level: 2, status: 'PENDING', approver: { fullName: 'Charlie Approver 2' } },
      ],
      approvalDecisions: [],
    } as never);

    const contract = await getContract('form-1', submitter);

    expect(detail).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          approvalSteps: expect.objectContaining({
            orderBy: { level: 'asc' },
          }),
          approvalDecisions: expect.objectContaining({
            orderBy: { createdAt: 'asc' },
          }),
        }),
      }),
    );
    expect(contract).toEqual(
      expect.objectContaining({
        approvalSteps: expect.arrayContaining([
          expect.objectContaining({ level: 1, approver: expect.objectContaining({ fullName: 'Bob Approver 1' }) }),
          expect.objectContaining({ level: 2, approver: expect.objectContaining({ fullName: 'Charlie Approver 2' }) }),
        ]),
      }),
    );
  });

  it('assigns a reference number when loading a legacy draft without one', async () => {
    const year = new Date().getUTCFullYear();
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
      referenceNo: null,
    } as never);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      contractForm: {
        findUnique: vi.fn().mockResolvedValue({ referenceNo: null }),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany,
      },
    };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) => callback(tx as never) as never,
    );
    vi.spyOn(prisma.contractForm, 'findUniqueOrThrow').mockResolvedValue({
      id: 'form-1',
      referenceNo: `CF-${year}-0001`,
    } as never);

    await expect(getContract('form-1', submitter)).resolves.toMatchObject({
      referenceNo: `CF-${year}-0001`,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'form-1', referenceNo: null },
      data: { referenceNo: `CF-${year}-0001` },
    });
  });

  it('allows an administrator to access another user contract', async () => {
    const findUnique = vi.spyOn(prisma.contractForm, 'findUnique');

    findUnique.mockResolvedValueOnce({
      id: 'form-1',
      createdById: 'other-user',
      status: ContractStatus.DRAFT,
    } as never);

    findUnique.mockResolvedValueOnce({
      id: 'form-1',
      createdById: 'other-user',
      status: ContractStatus.DRAFT,
    } as never);

    const detail = vi.spyOn(prisma.contractForm, 'findUniqueOrThrow').mockResolvedValue({
      id: 'form-1',
    } as never);

    await expect(getContract('form-1', admin)).resolves.toEqual({
      id: 'form-1',
    });

    detail.mockRestore();
    findUnique.mockRestore();
  });

  it('rejects a recommended vendor that is not a bidder', async () => {
    const formLookup = vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);

    const bidderLookup = vi.spyOn(prisma.bidder, 'findFirst').mockResolvedValue(null);

    await expect(
      updateContract('form-1', submitter, {
        recommendedVendorId: '00000000-0000-0000-0000-000000000001',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_RECOMMENDED_VENDOR',
    });

    bidderLookup.mockRestore();
    formLookup.mockRestore();
  });

  it('accepts a recommended vendor that is a bidder', async () => {
    const formLookup = vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);

    const bidderLookup = vi.spyOn(prisma.bidder, 'findFirst').mockResolvedValue({
      id: 'bidder-1',
      contractFormId: 'form-1',
      vendorId: '00000000-0000-0000-0000-000000000001',
    } as never);

    const update = vi.spyOn(prisma.contractForm, 'update').mockResolvedValue({
      id: 'form-1',
    } as never);

    await expect(
      updateContract('form-1', submitter, {
        recommendedVendorId: '00000000-0000-0000-0000-000000000001',
      }),
    ).resolves.toEqual({ id: 'form-1' });

    expect(update).toHaveBeenCalled();

    update.mockRestore();
    bidderLookup.mockRestore();
    formLookup.mockRestore();
  });

  it('prevents changing the vendor of the recommended bidder', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      recommendedVendorId: 'vendor-1',
      status: ContractStatus.DRAFT,
    } as never);

    vi.spyOn(prisma.bidder, 'findFirst').mockResolvedValue({
      id: 'bidder-1',
      contractFormId: 'form-1',
      vendorId: 'vendor-1',
    } as never);

    await expect(
      updateBidder('form-1', 'bidder-1', submitter, {
        vendorId: 'vendor-2',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'RECOMMENDED_VENDOR_BIDDER_CONFLICT',
    });
  });

  it('prevents deleting the recommended vendor bidder', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      recommendedVendorId: 'vendor-1',
      status: ContractStatus.DRAFT,
    } as never);

    vi.spyOn(prisma.bidder, 'findFirst').mockResolvedValue({
      id: 'bidder-1',
      contractFormId: 'form-1',
      vendorId: 'vendor-1',
    } as never);

    await expect(
      deleteBidder('form-1', 'bidder-1', submitter),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'RECOMMENDED_VENDOR_BIDDER_CONFLICT',
    });
  });

  it('prevents deleting a bidder with evaluations', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      recommendedVendorId: null,
      status: ContractStatus.DRAFT,
    } as never);

    vi.spyOn(prisma.bidder, 'findFirst').mockResolvedValue({
      id: 'bidder-1',
      contractFormId: 'form-1',
      vendorId: 'vendor-1',
    } as never);

    vi.spyOn(prisma.evaluation, 'findFirst').mockResolvedValue({
      id: 'evaluation-1',
    } as never);

    await expect(
      deleteBidder('form-1', 'bidder-1', submitter),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'BIDDER_HAS_EVALUATIONS',
    });
  });

  it('cleans quotations transactionally when deleting an eligible bidder', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      recommendedVendorId: null,
      status: ContractStatus.DRAFT,
    } as never);

    vi.spyOn(prisma.bidder, 'findFirst').mockResolvedValue({
      id: 'bidder-1',
      contractFormId: 'form-1',
      vendorId: 'vendor-1',
    } as never);

    vi.spyOn(prisma.evaluation, 'findFirst').mockResolvedValue(null);

    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const deleteBidderRecord = vi.fn().mockResolvedValue({ id: 'bidder-1' });

    const transaction = vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) =>
        callback({
          quotation: { deleteMany },
          bidder: { delete: deleteBidderRecord },
        } as never) as never,
    );

    await deleteBidder('form-1', 'bidder-1', submitter);

    expect(transaction).toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { bidderId: 'bidder-1' },
    });

    expect(deleteBidderRecord).toHaveBeenCalledWith({
      where: { id: 'bidder-1' },
    });
  });

  it('rejects an unknown currency when updating a quotation', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);

    vi.spyOn(prisma.quotation, 'findFirst').mockResolvedValue({
      id: 'quotation-1',
    } as never);

    vi.spyOn(prisma.currency, 'findUnique').mockResolvedValue(null);

    await expect(
      updateQuotation('form-1', 'bidder-1', 'quotation-1', submitter, {
        currencyId: 'currency-1',
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'CURRENCY_NOT_FOUND',
    });
  });

  it('allows clearing a quotation currency', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);

    vi.spyOn(prisma.quotation, 'findFirst').mockResolvedValue({
      id: 'quotation-1',
    } as never);

    const update = vi.spyOn(prisma.quotation, 'update').mockResolvedValue({
      id: 'quotation-1',
    } as never);

    vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) =>
        callback({
          quotation: { update },
        } as never) as never,
    );

    await updateQuotation('form-1', 'bidder-1', 'quotation-1', submitter, {
      currencyId: null,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currencyId: null,
        }),
      }),
    );
  });
});

// ---- Submission tests ----

describe('contract submission', () => {
  // Valid UUIDs are required by initializeWorkflowSchema.
  const formId = '550e8400-e29b-41d4-a716-446655440001';
  const approverId = '550e8400-e29b-41d4-a716-446655440002';
  const completeForm = {
    id: formId,
    formSchemaVersionId: 'legacy-v1',
    dynamicValues: {},
    formSchemaVersion: { id: 'legacy-v1', version: 1, definition: { sections: [] } },
    createdById: submitter.id,
    status: ContractStatus.DRAFT,
    title: 'Project',
    sponsorDepartmentId: 'department-1',
    contractCategoryId: 'category-1',
    scope: 'Scope',
    procurementRationale: 'Rationale',
    contractAmount: new Prisma.Decimal('30.00'),
    budgetProvision: new Prisma.Decimal('45.00'),
    currencyId: 'currency-1',
    recommendedVendorId: null,
    recommendedBidderId: 'bidder-1',
    selectionRationale: 'Selected after evaluation',
    bidders: [{
      id: 'bidder-1',
      vendorId: null,
      vendorTypeId: 'vendor-type-1',
      vendorType: { id: 'vendor-type-1', name: 'Consultant' },
      vendor: null,
      quotations: [{ quotedAmount: new Prisma.Decimal('30.00') }],
    }],
    evaluations: [
      { bidderId: 'bidder-1', type: 'TECHNICAL', score: new Prisma.Decimal('1'), remarks: 'Pass' },
      { bidderId: 'bidder-1', type: 'COMMERCIAL', score: new Prisma.Decimal('1'), remarks: 'Pass' },
    ],
    costLines: [{
      id: 'line-1',
      amount: new Prisma.Decimal('30.00'),
      quantity: new Prisma.Decimal('2.00'),
      unitCost: new Prisma.Decimal('15.00'),
    }],
  };

  it.each([
    ['budgetProvision', null, 'budgetProvision'],
    ['currencyId', null, 'currencyId'],
    ['recommendedBidderId', null, 'recommendedBidderId'],
  ])('requires %s when submitting', async (field, value, errorPath) => {
    vi.spyOn(prisma.contractForm, 'findUnique')
      .mockResolvedValueOnce({
        id: formId,
        createdById: submitter.id,
        status: ContractStatus.DRAFT,
      } as never)
      .mockResolvedValueOnce({
        ...completeForm,
        [field]: value,
      } as never);

    await expect(
      submitContract(formId, submitter, [approverId]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: expect.arrayContaining([expect.objectContaining({ path: errorPath })]),
    });
  });

  it('requires a vendor type for the selected contracting bidder', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique')
      .mockResolvedValueOnce({
        id: formId,
        createdById: submitter.id,
        status: ContractStatus.DRAFT,
      } as never)
      .mockResolvedValueOnce({
        ...completeForm,
        bidders: [{
          ...completeForm.bidders[0],
          vendorTypeId: null,
          vendorType: null,
        }],
      } as never);

    await expect(
      submitContract(formId, submitter, [approverId]),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: expect.arrayContaining([expect.objectContaining({ path: 'recommendedBidderId' })]),
    });
  });

it('submits a draft contract successfully', async () => {
  vi.spyOn(prisma.contractForm, 'findUnique')
    .mockResolvedValueOnce({
      id: formId,
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as any)
    .mockResolvedValueOnce({
      ...completeForm,
      id: formId,
      status: ContractStatus.DRAFT,
    } as any);

  const txMock = {
    contractForm: {
      findUnique: vi.fn().mockResolvedValue({
        id: formId,
        status: ContractStatus.PENDING_APPROVAL,
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  } as any;

  vi.spyOn(prisma, '$transaction').mockImplementation(
    async (cb: any) => cb(txMock),
  );

  const result = await submitContract(formId, submitter, [approverId]);

  expect(result).toEqual({
    id: formId,
    status: ContractStatus.PENDING_APPROVAL,
  });

  expect(initializeOrResetApprovalWorkflow).toHaveBeenCalledWith(
    formId,
    [approverId],
    submitter.id,
    txMock,
  );
});


 
it('resubmits a returned contract successfully', async () => {
  vi.spyOn(prisma.contractForm, 'findUnique')
    .mockResolvedValueOnce({
      id: formId,
      createdById: submitter.id,
      status: ContractStatus.RETURNED,
    } as any)
    .mockResolvedValueOnce({
      ...completeForm,
      id: formId,
      status: ContractStatus.RETURNED,
    } as any);

  const txMock = {
    contractForm: {
      findUnique: vi.fn().mockResolvedValue({
        id: formId,
        status: ContractStatus.PENDING_APPROVAL,
      }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  } as any;

  vi.spyOn(prisma, '$transaction').mockImplementation(
    async (cb: any) => cb(txMock),
  );

  const result = await submitContract(formId, submitter, [approverId]);

  expect(result).toEqual({
    id: formId,
    status: ContractStatus.PENDING_APPROVAL,
  });
});


  it('rejects submission by non-creator', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: formId,
      createdById: 'other-user',
      status: ContractStatus.DRAFT,
    } as any);

    await expect(
      submitContract(formId, submitter, [approverId]),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('fails validation of approverIds', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: formId,
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as any);

    await expect(
      submitContract(formId, submitter, ['not-a-uuid']),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects submission when contract not in allowed status', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: formId,
      createdById: submitter.id,
      status: ContractStatus.PENDING_APPROVAL,
    } as any);

    await expect(
      submitContract(formId, submitter, [approverId]),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATE',
    });
  });

  
it('rolls back transaction on error', async () => {
  vi.spyOn(prisma.contractForm, 'findUnique')
    .mockResolvedValueOnce({
      id: formId,
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as any)
    .mockResolvedValueOnce({
      ...completeForm,
      id: formId,
      status: ContractStatus.DRAFT,
    } as any);

  vi.spyOn(prisma, '$transaction').mockImplementation(async () => {
    throw new Error('boom');
  });

  await expect(
    submitContract(formId, submitter, [approverId]),
  ).rejects.toThrow('boom');
});

});
