import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractStatus, UserRole } from '@prisma/client';
import { prisma } from './lib/prisma';
import {
  bidderSchema,
  contractDraftSchema,
  contractListQuerySchema,
} from './schemas/contract.schema';
import {
  createDraft,
  getContract,
  listContracts,
  deleteBidder,
  updateBidder,
  updateQuotation,
  updateContract,
} from './services/contract.service';

const submitter = { id: 'user-1', role: UserRole.SUBMITTER };
const admin = { id: 'admin-1', role: UserRole.ADMIN };
const approver = { id: 'approver-1', role: UserRole.APPROVER };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('contract request validation', () => {
  it('accepts a partial draft with Decimal money as a string', () => {
    const result = contractDraftSchema.safeParse({ title: 'Draft', contractAmount: '12500.2500' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown mutation fields and invalid money', () => {
    expect(contractDraftSchema.safeParse({ status: 'APPROVED' }).success).toBe(false);
    expect(contractDraftSchema.safeParse({ contractAmount: '-1' }).success).toBe(false);
  });

  it('applies list defaults and rejects invalid bidder ordering', () => {
    expect(contractListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
    expect(bidderSchema.safeParse({ vendorId: 'not-a-uuid', sortOrder: -1 }).success).toBe(false);
  });
});

describe('contract service authorization and persistence', () => {
  it('creates a draft owned by the authenticated user', async () => {
    const create = vi.spyOn(prisma.contractForm, 'create').mockResolvedValue({
      id: 'form-1',
      status: ContractStatus.DRAFT,
      createdById: submitter.id,
    } as never);

    await createDraft(submitter, { title: 'Draft', contractAmount: '10.25' });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        createdById: submitter.id,
        status: ContractStatus.DRAFT,
      }),
    }));
    create.mockRestore();
  });

  it('lists only the submitter-owned records', async () => {
    const findMany = vi.spyOn(prisma.contractForm, 'findMany').mockResolvedValue([] as never);
    const count = vi.spyOn(prisma.contractForm, 'count').mockResolvedValue(0);
    const transaction = vi.spyOn(prisma, '$transaction').mockResolvedValue([
      [{ id: 'form-1' }],
      1,
    ] as never);

    await listContracts(submitter, { page: 1, pageSize: 20 });

    expect(transaction).toHaveBeenCalled();
    expect(transaction.mock.calls[0][0]).toBeInstanceOf(Array);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { createdById: submitter.id } }));
    expect(count).toHaveBeenCalled();
  });

  it('lists assigned contracts for approvers', async () => {
    const findMany = vi.spyOn(prisma.contractForm, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.contractForm, 'count').mockResolvedValue(0);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([[], 0] as never);

    await listContracts(approver, { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { approvalSteps: { some: { approverId: approver.id } } },
    }));
  });

  it('lists all contracts for administrators', async () => {
    const findMany = vi.spyOn(prisma.contractForm, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.contractForm, 'count').mockResolvedValue(0);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([[], 0] as never);

    await listContracts(admin, { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
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
      const detail = vi.spyOn(prisma.contractForm, 'findUniqueOrThrow').mockResolvedValue({ id: 'form-1' } as never);

      await expect(getContract('form-1', approver)).resolves.toEqual({ id: 'form-1' });
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

      await expect(getContract('form-1', submitter)).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
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

      await expect(getContract('form-1', approver)).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
      approvalLookup.mockRestore();
      findUnique.mockRestore();
  });

  it('allows the contract owner to view their own contract', async () => {
      const findUnique = vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
        id: 'form-1',
        createdById: submitter.id,
        status: ContractStatus.DRAFT,
      } as never);
      const detail = vi.spyOn(prisma.contractForm, 'findUniqueOrThrow').mockResolvedValue({ id: 'form-1' } as never);

      await expect(getContract('form-1', submitter)).resolves.toEqual({ id: 'form-1' });
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
    const detail = vi.spyOn(prisma.contractForm, 'findUniqueOrThrow').mockResolvedValue({ id: 'form-1' } as never);

    await expect(getContract('form-1', admin)).resolves.toEqual({ id: 'form-1' });
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

    await expect(updateContract('form-1', submitter, {
      recommendedVendorId: '00000000-0000-0000-0000-000000000001',
    })).rejects.toMatchObject({ statusCode: 409, code: 'INVALID_RECOMMENDED_VENDOR' });
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
    const update = vi.spyOn(prisma.contractForm, 'update').mockResolvedValue({ id: 'form-1' } as never);

    await expect(updateContract('form-1', submitter, {
      recommendedVendorId: '00000000-0000-0000-0000-000000000001',
    })).resolves.toEqual({ id: 'form-1' });
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

    await expect(updateBidder('form-1', 'bidder-1', submitter, {
      vendorId: 'vendor-2',
    })).rejects.toMatchObject({
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

    await expect(deleteBidder('form-1', 'bidder-1', submitter)).rejects.toMatchObject({
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
    vi.spyOn(prisma.evaluation, 'findFirst').mockResolvedValue({ id: 'evaluation-1' } as never);

    await expect(deleteBidder('form-1', 'bidder-1', submitter)).rejects.toMatchObject({
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
    const transaction = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => callback({
      quotation: { deleteMany },
      bidder: { delete: deleteBidderRecord },
    } as never) as never);

    await deleteBidder('form-1', 'bidder-1', submitter);

    expect(transaction).toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({ where: { bidderId: 'bidder-1' } });
    expect(deleteBidderRecord).toHaveBeenCalledWith({ where: { id: 'bidder-1' } });
  });

  it('rejects an unknown currency when updating a quotation', async () => {
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue({
      id: 'form-1',
      createdById: submitter.id,
      status: ContractStatus.DRAFT,
    } as never);
    vi.spyOn(prisma.quotation, 'findFirst').mockResolvedValue({ id: 'quotation-1' } as never);
    vi.spyOn(prisma.currency, 'findUnique').mockResolvedValue(null);

    await expect(updateQuotation('form-1', 'bidder-1', 'quotation-1', submitter, {
      currencyId: 'currency-1',
    })).rejects.toMatchObject({
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
    vi.spyOn(prisma.quotation, 'findFirst').mockResolvedValue({ id: 'quotation-1' } as never);
    const update = vi.spyOn(prisma.quotation, 'update').mockResolvedValue({ id: 'quotation-1' } as never);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) => callback({
      quotation: { update },
    } as never) as never);

    await updateQuotation('form-1', 'bidder-1', 'quotation-1', submitter, { currencyId: null });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ currencyId: null }),
    }));
  });
});
