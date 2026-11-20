
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
  getCostEstimate,
  getContract,
  listContracts,
  deleteContract,
  deleteBidder,
  submitContract,
  updateBidder,
  updateQuotation,
  updateContract,
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
    });

    expect(result.success).toBe(true);
  });

  it('rejects unknown mutation fields and invalid money', () => {
    expect(contractDraftSchema.safeParse({ status: 'APPROVED' }).success).toBe(false);
    expect(contractDraftSchema.safeParse({ contractAmount: '-1' }).success).toBe(false);
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

describe('contract retention policy', () => {
  it('does not allow submitters to delete a contract', async () => {
    await expect(
      deleteContract('form-1', submitter, 'Approved deletion request'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('retains existing audit events and records the Admin-approved deletion', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      referenceNo: 'CF-0001',
      title: 'Archived project',
    } as never);

    const auditUpdateMany = vi.fn().mockResolvedValue({ count: 2 });
    const auditCreate = vi.fn().mockResolvedValue({ id: 'audit-delete' });
    const contractDelete = vi.fn().mockResolvedValue({ id: 'form-1' });
    const tx = {
      contractForm: {
        update: vi.fn().mockResolvedValue({}),
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

    await deleteContract('form-1', admin, 'Duplicate record approved for deletion');

    expect(auditUpdateMany).toHaveBeenCalledWith({
      where: { contractFormId: 'form-1' },
      data: { contractFormId: null },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: admin.id,
        action: 'CONTRACT_DELETED',
        entityType: 'ContractForm',
        entityId: 'form-1',
        details: expect.objectContaining({
          reason: 'Duplicate record approved for deletion',
          referenceNo: 'CF-0001',
        }),
      }),
    });
    expect(tx.auditLog).not.toHaveProperty('deleteMany');
    expect(contractDelete).toHaveBeenCalledWith({ where: { id: 'form-1' } });
  });
});

describe('Admin contract deletion endpoint', () => {
  const formId = '550e8400-e29b-41d4-a716-446655440001';

  function context(authUser: unknown, body: Record<string, unknown> = {}) {
    return {
      req: {
        requestId: 'delete-test',
        params: { id: formId },
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

  it('requires an Admin, a reason, and explicit confirmation before touching Drive', async () => {
    const denied = context(submitter, { reason: 'Approved cleanup', confirm: true });
    const invalid = context(admin, { reason: 'short', confirm: true });
    const cleanup = vi.spyOn(documentsRuntime, 'deleteContractAttachments');

    await deleteContractHandler(denied.req, denied.res, denied.next);
    await deleteContractHandler(invalid.req, invalid.res, invalid.next);

    expect(denied.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(invalid.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('cleans Drive files before deleting database records and audit history', async () => {
    const valid = context(admin, {
      reason: 'Duplicate record approved for deletion',
      confirm: true,
    });
    const cleanup = vi.spyOn(documentsRuntime, 'deleteContractAttachments').mockResolvedValue();
    const remove = vi.spyOn(contractService, 'deleteContract').mockResolvedValue({ id: formId } as never);

    await deleteContractHandler(valid.req, valid.res, valid.next);

    expect(cleanup).toHaveBeenCalledWith(formId);
    expect(remove).toHaveBeenCalledWith(formId, admin, 'Duplicate record approved for deletion');
    expect(cleanup.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]);
    expect(valid.next).not.toHaveBeenCalled();
    expect(valid.res.status).toHaveBeenCalledWith(200);
  });

  it('does not delete database records when Drive cleanup fails', async () => {
    const valid = context(admin, {
      reason: 'Duplicate record approved for deletion',
      confirm: true,
    });
    vi.spyOn(documentsRuntime, 'deleteContractAttachments').mockRejectedValue(
      new Error('Drive unavailable')
    );
    const remove = vi.spyOn(contractService, 'deleteContract');

    await deleteContractHandler(valid.req, valid.res, valid.next);

    expect(remove).not.toHaveBeenCalled();
    expect(valid.next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('contract service authorization and persistence', () => {
  const completeForm = {
    id: 'form-1',
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
    const create = vi.spyOn(prisma.contractForm, 'create').mockResolvedValue({
      id: 'form-1',
      status: ContractStatus.DRAFT,
      createdById: submitter.id,
    } as never);

    await createDraft(submitter, {
      title: 'Draft',
      contractAmount: '10.25',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: submitter.id,
          status: ContractStatus.DRAFT,
        }),
      }),
    );

    create.mockRestore();
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
