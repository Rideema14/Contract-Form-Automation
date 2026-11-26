import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextFunction, Request, Response } from 'express';
import {
  ApprovalDecisionValue,
  ApprovalStatus,
  ContractStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from './lib/prisma';
import {
  approvalStepIdParamSchema,
  approveActionSchema,
  initializeWorkflowSchema,
  pendingApprovalsQuerySchema,
  rejectActionSchema,
  returnActionSchema,
} from './schemas/approval.schema';
import {
  approveStep,
  getApprovalHistory,
  getApprovalStepDetail,
  getPendingApprovals,
  initializeOrResetApprovalWorkflow,
  rejectStep,
  returnStep,
} from './services/approval.service';
import * as approvalService from './services/approval.service';
import * as documentsRuntime from './modules/documents/documents.runtime';
import {
  approveStepHandler,
  getApprovalDetail,
  getApprovalHistoryHandler,
  listPendingApprovals,
  rejectStepHandler,
  returnStepHandler,
} from './controllers/approvals.controller';

const submitter = { id: 'user-submitter-1', role: UserRole.SUBMITTER, fullName: 'Alice Submitter' };
const approver1 = { id: 'user-approver-1', role: UserRole.APPROVER, fullName: 'Bob Approver 1' };
const approver2 = { id: 'user-approver-2', role: UserRole.APPROVER, fullName: 'Charlie Approver 2' };
const approver3 = { id: 'user-approver-3', role: UserRole.APPROVER, fullName: 'Diana Approver 3' };
const admin = { id: 'user-admin-1', role: UserRole.ADMIN, fullName: 'Dave Admin' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Approval Schemas Validation', () => {
  it('validates approve action payload with optional comment', () => {
    expect(approveActionSchema.safeParse({}).success).toBe(true);
    expect(approveActionSchema.safeParse({ comment: 'Looks good to proceed' }).success).toBe(true);
    expect(approveActionSchema.safeParse({ comment: null }).success).toBe(true);
    expect(approveActionSchema.safeParse({ extra: 'not-allowed' }).success).toBe(false);
  });

  it('enforces mandatory non-empty comment for return action', () => {
    expect(returnActionSchema.safeParse({}).success).toBe(false);
    expect(returnActionSchema.safeParse({ comment: '' }).success).toBe(false);
    expect(returnActionSchema.safeParse({ comment: '   ' }).success).toBe(false);
    expect(returnActionSchema.safeParse({ comment: 'Please update bidder evaluation scores' }).success).toBe(true);
  });

  it('enforces mandatory non-empty comment for reject action', () => {
    expect(rejectActionSchema.safeParse({}).success).toBe(false);
    expect(rejectActionSchema.safeParse({ comment: '' }).success).toBe(false);
    expect(rejectActionSchema.safeParse({ comment: '   ' }).success).toBe(false);
    expect(rejectActionSchema.safeParse({ comment: 'Procurement rationale insufficient' }).success).toBe(true);
  });

  it('validates pagination query with defaults and limits', () => {
    const defaultQuery = pendingApprovalsQuerySchema.parse({});
    expect(defaultQuery).toEqual({ page: 1, pageSize: 20 });

    const customQuery = pendingApprovalsQuerySchema.parse({ page: '2', pageSize: '50' });
    expect(customQuery).toEqual({ page: 2, pageSize: 50 });

    expect(pendingApprovalsQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(pendingApprovalsQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it('validates UUID parameter format', () => {
    expect(approvalStepIdParamSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(true);
    expect(approvalStepIdParamSchema.safeParse({ id: 'invalid-uuid' }).success).toBe(false);
  });

  it('validates initializeWorkflowSchema rejects duplicates and empty lists', () => {
    expect(initializeWorkflowSchema.safeParse({ approverIds: [] }).success).toBe(false);
    expect(initializeWorkflowSchema.safeParse({
      approverIds: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174000'],
    }).success).toBe(false);
    expect(initializeWorkflowSchema.safeParse({
      approverIds: ['123e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174000'],
    }).success).toBe(true);
  });
});

describe('Approval Service - Queries and Access Control', () => {
  it('denies submitters access to the pending approvals queue', async () => {
    await expect(getPendingApprovals(submitter, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('retrieves assigned pending approvals for an approver', async () => {
    const findMany = vi.spyOn(prisma.approvalStep, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.approvalStep, 'count').mockResolvedValue(0);
    const transaction = vi.spyOn(prisma, '$transaction').mockResolvedValue([
      [{ id: 'step-1', level: 1 }],
      1,
    ] as never);

    const result = await getPendingApprovals(approver1, { page: 1, pageSize: 20 });

    expect(transaction).toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: ApprovalStatus.PENDING,
          approverId: approver1.id,
        }),
      }),
    );
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
  });

  it('allows administrators to view all pending approvals across the system', async () => {
    const findMany = vi.spyOn(prisma.approvalStep, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.approvalStep, 'count').mockResolvedValue(0);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([[], 0] as never);

    await getPendingApprovals(admin, { page: 1, pageSize: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ApprovalStatus.PENDING,
          contractForm: { status: ContractStatus.PENDING_APPROVAL },
        },
      }),
    );
  });

  it('denies an unauthorized user from viewing approval step details', async () => {
    vi.spyOn(prisma.approvalStep, 'findUnique').mockResolvedValue({
      id: 'step-1',
      approverId: 'other-approver',
      contractForm: {
        createdById: 'other-submitter',
        approvalSteps: [{ approverId: 'other-approver' }],
      },
    } as never);

    await expect(getApprovalStepDetail('step-1', approver1)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('returns 404 for a non-existent approval step detail', async () => {
    vi.spyOn(prisma.approvalStep, 'findUnique').mockResolvedValue(null);

    await expect(getApprovalStepDetail('non-existent', approver1)).rejects.toMatchObject({
      statusCode: 404,
      code: 'APPROVAL_NOT_FOUND',
    });
  });

  it('allows the assigned approver to view approval step details', async () => {
    const mockStep = {
      id: 'step-1',
      approverId: approver1.id,
      contractForm: {
        createdById: submitter.id,
        approvalSteps: [{ approverId: approver1.id }],
      },
    };
    vi.spyOn(prisma.approvalStep, 'findUnique').mockResolvedValue(mockStep as never);

    const step = await getApprovalStepDetail('step-1', approver1);
    expect(step).toEqual(mockStep);
  });

  it('retrieves complete approval history for contract creator', async () => {
    const mockForm = {
      id: 'form-1',
      referenceNo: 'CTR-2026-001',
      title: 'IT Hardware Procurement',
      status: ContractStatus.PENDING_APPROVAL,
      createdById: submitter.id,
      approvalSteps: [],
      approvalDecisions: [],
      auditLogs: [],
    };
    vi.spyOn(prisma.contractForm, 'findUnique').mockResolvedValue(mockForm as never);

    const history = await getApprovalHistory('form-1', submitter);
    expect(history.contractFormId).toBe('form-1');
    expect(history.referenceNo).toBe('CTR-2026-001');
  });
});

describe('Approval Service - Sequential Workflow & State Transitions', () => {
  it('advances from Level 1 to Level 2 on intermediate approval', async () => {
    const step1 = {
      id: 'step-1',
      level: 1,
      approverId: approver1.id,
      status: ApprovalStatus.PENDING,
      contractFormId: 'form-1',
      contractForm: {
        id: 'form-1',
        title: 'Network Equipment',
        referenceNo: 'CTR-001',
        status: ContractStatus.PENDING_APPROVAL,
        createdById: submitter.id,
      },
    };

    const nextStep = {
      id: 'step-2',
      level: 2,
      approverId: approver2.id,
      status: ApprovalStatus.WAITING,
      actedAt: null,
      contractFormId: 'form-1',
    };

    const updateManyStep = vi.fn().mockResolvedValue({ count: 1 });
    const createDecision = vi.fn().mockResolvedValue({ id: 'dec-1', decision: ApprovalDecisionValue.APPROVED });
    const findNextStep = vi.fn().mockResolvedValue(nextStep);
    const updateNextStep = vi.fn().mockResolvedValue({ ...nextStep, status: ApprovalStatus.PENDING });
    const createNotification = vi.fn().mockResolvedValue({ id: 'notif-1' });
    const createAuditLog = vi.fn().mockResolvedValue({ id: 'audit-1' });

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: {
          findUnique: vi.fn().mockResolvedValue(step1),
          updateMany: updateManyStep,
          findFirst: findNextStep,
          update: updateNextStep,
        },
        approvalDecision: { create: createDecision },
        notification: { create: createNotification },
        auditLog: { create: createAuditLog },
      } as never),
    );

    const result = await approveStep('step-1', approver1, { comment: 'Level 1 approved' });

    expect(updateManyStep).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'step-1', approverId: approver1.id, status: ApprovalStatus.PENDING }),
        data: expect.objectContaining({ status: ApprovalStatus.APPROVED }),
      }),
    );
    expect(findNextStep).toHaveBeenCalledWith({
      where: {
        contractFormId: 'form-1',
        level: 2,
        status: ApprovalStatus.WAITING,
        actedAt: null,
      },
    });
    expect(createDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ decision: ApprovalDecisionValue.APPROVED, comment: 'Level 1 approved' }),
      }),
    );
    expect(updateNextStep).toHaveBeenCalledWith({
      where: { id: 'step-2' },
      data: { status: ApprovalStatus.PENDING },
    });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientId: approver2.id }),
      }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientId: submitter.id,
          message: expect.stringContaining('Level 2'),
        }),
      }),
    );
    expect(result.contractStatus).toBe(ContractStatus.PENDING_APPROVAL);
    expect(result.nextStep).toEqual({
      level: 2,
      approverId: approver2.id,
      status: ApprovalStatus.PENDING,
    });
  });

  it('marks contract as APPROVED on final approval (no subsequent active step)', async () => {
    const step2 = {
      id: 'step-2',
      level: 2,
      approverId: approver2.id,
      status: ApprovalStatus.PENDING,
      contractFormId: 'form-1',
      contractForm: {
        id: 'form-1',
        title: 'Network Equipment',
        referenceNo: 'CTR-001',
        status: ContractStatus.PENDING_APPROVAL,
        createdById: submitter.id,
      },
    };

    const updateManyStep = vi.fn().mockResolvedValue({ count: 1 });
    const createDecision = vi.fn().mockResolvedValue({ id: 'dec-2', decision: ApprovalDecisionValue.APPROVED });
    const findNextStep = vi.fn().mockResolvedValue(null); // No step 3 -> Final approval
    const updateContractForm = vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.APPROVED });
    const createNotification = vi.fn().mockResolvedValue({ id: 'notif-2' });
    const createAuditLog = vi.fn().mockResolvedValue({ id: 'audit-2' });

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: {
          findUnique: vi.fn().mockResolvedValue(step2),
          updateMany: updateManyStep,
          findFirst: findNextStep,
        },
        contractForm: { update: updateContractForm },
        approvalDecision: { create: createDecision },
        notification: { create: createNotification },
        auditLog: { create: createAuditLog },
      } as never),
    );

    const result = await approveStep('step-2', approver2, { comment: 'Final sign-off' });

    expect(updateContractForm).toHaveBeenCalledWith({
      where: { id: 'form-1' },
      data: { status: ContractStatus.APPROVED },
    });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientId: submitter.id }),
      }),
    );
    expect(result.contractStatus).toBe(ContractStatus.APPROVED);
    expect(result.nextStep).toBeNull();
  });

  it('returns contract for modifications with mandatory comment', async () => {
    const step1 = {
      id: 'step-1',
      level: 1,
      approverId: approver1.id,
      status: ApprovalStatus.PENDING,
      contractFormId: 'form-1',
      contractForm: {
        id: 'form-1',
        title: 'Network Equipment',
        referenceNo: 'CTR-001',
        status: ContractStatus.PENDING_APPROVAL,
        createdById: submitter.id,
      },
    };

    const updateManyStep = vi.fn().mockResolvedValue({ count: 1 });
    const createDecision = vi.fn().mockResolvedValue({ id: 'dec-r', decision: ApprovalDecisionValue.RETURNED });
    const updateContractForm = vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.RETURNED });
    const createNotification = vi.fn().mockResolvedValue({ id: 'notif-r' });
    const createAuditLog = vi.fn().mockResolvedValue({ id: 'audit-r' });

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: {
          findUnique: vi.fn().mockResolvedValue(step1),
          updateMany: updateManyStep,
        },
        contractForm: { update: updateContractForm },
        approvalDecision: { create: createDecision },
        notification: { create: createNotification },
        auditLog: { create: createAuditLog },
      } as never),
    );

    const result = await returnStep('step-1', approver1, { comment: 'Please adjust quantity on Line 2' });

    expect(updateManyStep).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ approverId: approver1.id }),
        data: expect.objectContaining({ status: ApprovalStatus.RETURNED }),
      }),
    );
    expect(updateContractForm).toHaveBeenCalledWith({
      where: { id: 'form-1' },
      data: { status: ContractStatus.RETURNED },
    });
    expect(result.status).toBe(ApprovalStatus.RETURNED);
    expect(result.contractStatus).toBe(ContractStatus.RETURNED);
  });

  it('rejects contract and terminates remaining waiting steps', async () => {
    const step1 = {
      id: 'step-1',
      level: 1,
      approverId: approver1.id,
      status: ApprovalStatus.PENDING,
      contractFormId: 'form-1',
      contractForm: {
        id: 'form-1',
        title: 'Network Equipment',
        referenceNo: 'CTR-001',
        status: ContractStatus.PENDING_APPROVAL,
        createdById: submitter.id,
      },
    };

    const updateManyStep = vi.fn().mockResolvedValue({ count: 1 });
    const cancelRemainingSteps = vi.fn().mockResolvedValue({ count: 1 });
    const createDecision = vi.fn().mockResolvedValue({ id: 'dec-x', decision: ApprovalDecisionValue.REJECTED });
    const updateContractForm = vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.REJECTED });
    const createNotification = vi.fn().mockResolvedValue({ id: 'notif-x' });
    const createAuditLog = vi.fn().mockResolvedValue({ id: 'audit-x' });

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: {
          findUnique: vi.fn().mockResolvedValue(step1),
          updateMany: vi.fn().mockImplementation(({ where }) => {
            if (where.level) return cancelRemainingSteps();
            return updateManyStep();
          }),
        },
        contractForm: { update: updateContractForm },
        approvalDecision: { create: createDecision },
        notification: { create: createNotification },
        auditLog: { create: createAuditLog },
      } as never),
    );

    const result = await rejectStep('step-1', approver1, { comment: 'Budget exceeded allocation limit' });

    expect(updateContractForm).toHaveBeenCalledWith({
      where: { id: 'form-1' },
      data: { status: ContractStatus.REJECTED },
    });
    expect(result.status).toBe(ApprovalStatus.REJECTED);
    expect(result.contractStatus).toBe(ContractStatus.REJECTED);
  });
});

describe('Approval Service - Security, Authorization, and Concurrency Guards', () => {
  it('prevents an unauthorized approver from acting on a step', async () => {
    const step = {
      id: 'step-1',
      approverId: 'legitimate-approver-id',
      status: ApprovalStatus.PENDING,
      contractForm: { status: ContractStatus.PENDING_APPROVAL },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: { findUnique: vi.fn().mockResolvedValue(step) },
      } as never),
    );

    await expect(approveStep('step-1', approver1)).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ASSIGNED_APPROVER',
    });
  });

  it('prevents an ADMIN from mutating an approval step assigned to someone else', async () => {
    const step = {
      id: 'step-1',
      approverId: approver1.id,
      status: ApprovalStatus.PENDING,
      contractForm: { status: ContractStatus.PENDING_APPROVAL },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: { findUnique: vi.fn().mockResolvedValue(step) },
      } as never),
    );

    await expect(approveStep('step-1', admin)).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ASSIGNED_APPROVER',
    });

    await expect(returnStep('step-1', admin, { comment: 'Admin return attempt' })).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ASSIGNED_APPROVER',
    });

    await expect(rejectStep('step-1', admin, { comment: 'Admin reject attempt' })).rejects.toMatchObject({
      statusCode: 403,
      code: 'NOT_ASSIGNED_APPROVER',
    });
  });

  it('allows the assigned approver to act on their pending step', async () => {
    const step = {
      id: 'step-1',
      level: 1,
      approverId: approver1.id,
      status: ApprovalStatus.PENDING,
      contractFormId: 'form-1',
      contractForm: {
        id: 'form-1',
        status: ContractStatus.PENDING_APPROVAL,
        createdById: submitter.id,
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: {
          findUnique: vi.fn().mockResolvedValue(step),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        contractForm: { update: vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.APPROVED }) },
        approvalDecision: { create: vi.fn().mockResolvedValue({ id: 'dec-1' }) },
        notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1' }) },
        auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
      } as never),
    );

    const result = await approveStep('step-1', approver1);
    expect(result.status).toBe(ApprovalStatus.APPROVED);
  });

  it('prevents actions on a step that is not in PENDING status', async () => {
    const step = {
      id: 'step-1',
      approverId: approver1.id,
      status: ApprovalStatus.APPROVED,
      contractForm: { status: ContractStatus.APPROVED },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: { findUnique: vi.fn().mockResolvedValue(step) },
      } as never),
    );

    await expect(approveStep('step-1', approver1)).rejects.toMatchObject({
      statusCode: 409,
      code: 'STEP_NOT_PENDING',
    });
  });

  it('prevents duplicate or simultaneous actions via atomic update check (returns 409)', async () => {
    const step = {
      id: 'step-1',
      approverId: approver1.id,
      status: ApprovalStatus.PENDING,
      contractForm: { status: ContractStatus.PENDING_APPROVAL },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback) =>
      callback({
        approvalStep: {
          findUnique: vi.fn().mockResolvedValue(step),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      } as never),
    );

    await expect(approveStep('step-1', approver1)).rejects.toMatchObject({
      statusCode: 409,
      code: 'STEP_NOT_PENDING',
    });
  });
});

describe('Approval Workflow Initialization, Validation, and Resubmission', () => {
  it('rejects an empty approver list with HTTP 400', async () => {
    const mockTx = {} as never;
    await expect(
      initializeOrResetApprovalWorkflow('form-1', [], submitter.id, mockTx),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('rejects duplicate approver IDs in approverIds with HTTP 400 DUPLICATE_APPROVER', async () => {
    const mockTx = {} as never;
    await expect(
      initializeOrResetApprovalWorkflow('form-1', [approver1.id, approver1.id], submitter.id, mockTx),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'DUPLICATE_APPROVER',
    });
  });

  it('rejects submission if contract status is APPROVED or REJECTED with HTTP 409', async () => {
    const mockTxApproved = {
      contractForm: {
        findUnique: vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.APPROVED }),
      },
    };
    await expect(
      initializeOrResetApprovalWorkflow('form-1', [approver1.id], submitter.id, mockTxApproved as never),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATE',
    });

    const mockTxRejected = {
      contractForm: {
        findUnique: vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.REJECTED }),
      },
    };
    await expect(
      initializeOrResetApprovalWorkflow('form-1', [approver1.id], submitter.id, mockTxRejected as never),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATE',
    });
  });

  it('allows submission when contract is in DRAFT status', async () => {
    const mockTx = {
      contractForm: {
        findUnique: vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.DRAFT }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([{ id: approver1.id, role: UserRole.APPROVER }]),
      },
      approvalStep: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: `step-${data.level}`, ...data })),
      },
      notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1' }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };

    const steps = await initializeOrResetApprovalWorkflow('form-1', [approver1.id], submitter.id, mockTx as never);
    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe(ApprovalStatus.PENDING);
    expect(mockTx.contractForm.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'form-1' }),
        data: expect.objectContaining({ status: ContractStatus.PENDING_APPROVAL }),
      }),
    );
  });

  it('allows resubmission when contract is in RETURNED status with same number of approvers', async () => {
    const existingSteps = [
      { id: 'step-1', level: 1, approverId: approver1.id, status: ApprovalStatus.APPROVED },
      { id: 'step-2', level: 2, approverId: approver2.id, status: ApprovalStatus.RETURNED },
    ];

    const mockTx = {
      contractForm: {
        findUnique: vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.RETURNED }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: approver1.id, role: UserRole.APPROVER },
          { id: approver2.id, role: UserRole.APPROVER },
        ]),
      },
      approvalStep: {
        findMany: vi.fn().mockResolvedValue(existingSteps),
        update: vi.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
      notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1' }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };

    const steps = await initializeOrResetApprovalWorkflow(
      'form-1',
      [approver1.id, approver2.id],
      submitter.id,
      mockTx as never,
    );

    expect(steps).toHaveLength(2);
    expect(mockTx.approvalStep.update).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'step-1' },
    }));
    expect(mockTx.approvalStep.update).toHaveBeenCalledWith({
      where: { id: 'step-2' },
      data: expect.objectContaining({ status: ApprovalStatus.PENDING, actedAt: null }),
    });
  });

  it('handles resubmission with more approvers by creating additional levels', async () => {
    const existingSteps = [
      { id: 'step-1', level: 1, approverId: approver1.id, status: ApprovalStatus.APPROVED },
      { id: 'step-2', level: 2, approverId: approver2.id, status: ApprovalStatus.RETURNED },
    ];

    const mockTx = {
      contractForm: {
        findUnique: vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.RETURNED }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: approver1.id, role: UserRole.APPROVER },
          { id: approver2.id, role: UserRole.APPROVER },
          { id: approver3.id, role: UserRole.APPROVER },
        ]),
      },
      approvalStep: {
        findMany: vi.fn().mockResolvedValue(existingSteps),
        update: vi.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'step-3', ...data })),
      },
      notification: { create: vi.fn().mockResolvedValue({ id: 'notif-1' }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };

    const steps = await initializeOrResetApprovalWorkflow(
      'form-1',
      [approver1.id, approver2.id, approver3.id],
      submitter.id,
      mockTx as never,
    );

    expect(steps).toHaveLength(3);
    expect(mockTx.approvalStep.update).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'step-1' },
    }));
    expect(mockTx.approvalStep.update).toHaveBeenCalledWith({
      where: { id: 'step-2' },
      data: expect.objectContaining({ status: ApprovalStatus.PENDING, actedAt: null }),
    });
    expect(mockTx.approvalStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ level: 3, approverId: approver3.id, status: ApprovalStatus.WAITING, actedAt: null }),
      }),
    );
  });

  it('handles shortened approval chains on resubmission: surplus steps remain inert and B approval marks contract APPROVED', async () => {
    // Scenario:
    // Past chain: Level 1 (A) -> Level 2 (B) -> Level 3 (C)
    // Contract was returned by C (Step 3 has decision 'RETURNED')
    // Submitter resubmits with only 2 approvers: [A, B]
    const existingSteps = [
      { id: 'step-1', level: 1, approverId: approver1.id, status: ApprovalStatus.APPROVED },
      { id: 'step-2', level: 2, approverId: approver2.id, status: ApprovalStatus.APPROVED },
      { id: 'step-3', level: 3, approverId: approver3.id, status: ApprovalStatus.RETURNED, actedAt: new Date('2026-11-16') },
    ];

    const mockStep3Decision = { id: 'dec-step-3', decision: ApprovalDecisionValue.RETURNED };
    const createNotification = vi.fn().mockResolvedValue({ id: 'notif-1' });

    const mockTxInit = {
      contractForm: {
        findUnique: vi.fn().mockResolvedValue({ id: 'form-1', status: ContractStatus.RETURNED }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([
          { id: approver1.id, role: UserRole.APPROVER },
          { id: approver2.id, role: UserRole.APPROVER },
        ]),
      },
      approvalStep: {
        findMany: vi.fn().mockResolvedValue(existingSteps),
        update: vi.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
        delete: vi.fn(),
      },
      approvalDecision: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.approvalStepId === 'step-3') return Promise.resolve(mockStep3Decision);
          return Promise.resolve(null);
        }),
      },
      notification: { create: createNotification },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };

    // 1. Resubmit with shortened chain [approver1, approver2]
    const steps = await initializeOrResetApprovalWorkflow(
      'form-1',
      [approver1.id, approver2.id],
      submitter.id,
      mockTxInit as never,
    );

    // Active steps are strictly levels 1 and 2
    expect(steps).toHaveLength(2);
    // Surplus step-3 is NOT deleted (preserving decisions and foreign keys)
    expect(mockTxInit.approvalStep.delete).not.toHaveBeenCalled();
    // Surplus step-3 was NOT reset to WAITING or actedAt=null
    expect(mockTxInit.approvalStep.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'step-3' },
        data: expect.objectContaining({ status: ApprovalStatus.WAITING, actedAt: null }),
      }),
    );

    expect(mockTxInit.contractForm.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: ContractStatus.APPROVED }),
    }));
    // Notification goes to contract creator, NOT to the old Level 3 approver
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipientId: submitter.id }),
      }),
    );
  });
});

describe('Approvals Controller Handlers', () => {
  const validUUID = '123e4567-e89b-12d3-a456-426614174000';

  function createMockContext(overrides: {
    authUser?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
    body?: Record<string, unknown>;
  } = {}) {
    const req = {
      requestId: 'test-req-id',
      authUser: overrides.authUser !== undefined ? overrides.authUser : approver1,
      params: overrides.params || {},
      query: overrides.query || {},
      body: overrides.body || {},
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    return { req, res, next };
  }

  it('listPendingApprovals requires authentication and returns formatted response', async () => {
    // Unauthenticated
    const unauthCtx = createMockContext({ authUser: null });
    await listPendingApprovals(unauthCtx.req, unauthCtx.res, unauthCtx.next);
    expect(unauthCtx.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED' }));

    // Invalid query validation
    const invalidQueryCtx = createMockContext({ query: { pageSize: '200' } });
    await listPendingApprovals(invalidQueryCtx.req, invalidQueryCtx.res, invalidQueryCtx.next);
    expect(invalidQueryCtx.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' }));

    // Valid query
    const validCtx = createMockContext({ query: { page: '1', pageSize: '10' } });
    vi.spyOn(approvalService, 'getPendingApprovals').mockResolvedValue({
      items: [{ id: 'step-1' }] as never,
      pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
    });

    await listPendingApprovals(validCtx.req, validCtx.res, validCtx.next);
    expect(validCtx.res.status).toHaveBeenCalledWith(200);
    expect(validCtx.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Pending approvals retrieved',
      data: { items: [{ id: 'step-1' }] },
      meta: expect.objectContaining({ pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }),
    }));
  });

  it('getApprovalDetail validates UUID and returns step details', async () => {
    // Invalid UUID
    const invalidCtx = createMockContext({ params: { id: 'invalid-id' } });
    await getApprovalDetail(invalidCtx.req, invalidCtx.res, invalidCtx.next);
    expect(invalidCtx.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' }));

    // Valid UUID
    const validCtx = createMockContext({ params: { id: validUUID } });
    vi.spyOn(approvalService, 'getApprovalStepDetail').mockResolvedValue({ id: validUUID } as never);

    await getApprovalDetail(validCtx.req, validCtx.res, validCtx.next);
    expect(validCtx.res.status).toHaveBeenCalledWith(200);
    expect(validCtx.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Approval details retrieved',
      data: { id: validUUID },
    }));
  });

  it('approveStepHandler validates payload and calls service', async () => {
    const validCtx = createMockContext({
      params: { id: validUUID },
      body: { comment: 'Approving this request' },
    });
    vi.spyOn(approvalService, 'approveStep').mockResolvedValue({
      stepId: validUUID,
      status: ApprovalStatus.APPROVED,
      contractStatus: ContractStatus.PENDING_APPROVAL,
    } as never);

    await approveStepHandler(validCtx.req, validCtx.res, validCtx.next);
    expect(validCtx.res.status).toHaveBeenCalledWith(200);
    expect(validCtx.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Contract approved successfully',
    }));
  });

  it('keeps final approval successful when final PDF generation fails', async () => {
    const validCtx = createMockContext({
      params: { id: validUUID },
      body: {},
    });
    vi.spyOn(approvalService, 'approveStep').mockResolvedValue({
      stepId: validUUID,
      status: ApprovalStatus.APPROVED,
      contractStatus: ContractStatus.APPROVED,
      contractFormId: 'form-1',
    } as never);
    vi.spyOn(documentsRuntime, 'generateAndStoreFinalPdf').mockRejectedValue(
      new Error('Drive unavailable')
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await approveStepHandler(validCtx.req, validCtx.res, validCtx.next);

    expect(validCtx.next).not.toHaveBeenCalled();
    expect(validCtx.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        finalPdf: {
          status: 'failed',
          message: 'The contract was approved, but its PDF could not be generated. An administrator can retry.',
        },
      }),
    }));
  });

  it('returnStepHandler enforces comment and calls service', async () => {
    // Missing comment
    const invalidCtx = createMockContext({
      params: { id: validUUID },
      body: { comment: '' },
    });
    await returnStepHandler(invalidCtx.req, invalidCtx.res, invalidCtx.next);
    expect(invalidCtx.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' }));

    // Valid comment
    const validCtx = createMockContext({
      params: { id: validUUID },
      body: { comment: 'Please adjust quotation notes' },
    });
    vi.spyOn(approvalService, 'returnStep').mockResolvedValue({
      stepId: validUUID,
      status: ApprovalStatus.RETURNED,
    } as never);

    await returnStepHandler(validCtx.req, validCtx.res, validCtx.next);
    expect(validCtx.res.status).toHaveBeenCalledWith(200);
    expect(validCtx.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Contract returned for changes',
    }));
  });

  it('rejectStepHandler enforces comment and calls service', async () => {
    // Missing comment
    const invalidCtx = createMockContext({
      params: { id: validUUID },
      body: {},
    });
    await rejectStepHandler(invalidCtx.req, invalidCtx.res, invalidCtx.next);
    expect(invalidCtx.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' }));

    // Valid comment
    const validCtx = createMockContext({
      params: { id: validUUID },
      body: { comment: 'Vendor selection does not match procurement guidelines' },
    });
    vi.spyOn(approvalService, 'rejectStep').mockResolvedValue({
      stepId: validUUID,
      status: ApprovalStatus.REJECTED,
    } as never);

    await rejectStepHandler(validCtx.req, validCtx.res, validCtx.next);
    expect(validCtx.res.status).toHaveBeenCalledWith(200);
    expect(validCtx.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Contract rejected',
    }));
  });

  it('getApprovalHistoryHandler validates formId and returns history', async () => {
    // Invalid UUID
    const invalidCtx = createMockContext({ params: { id: 'bad-uuid' } });
    await getApprovalHistoryHandler(invalidCtx.req, invalidCtx.res, invalidCtx.next);
    expect(invalidCtx.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' }));

    // Valid UUID
    const validCtx = createMockContext({ params: { id: validUUID } });
    vi.spyOn(approvalService, 'getApprovalHistory').mockResolvedValue({
      contractFormId: validUUID,
      approvalSteps: [],
    } as never);

    await getApprovalHistoryHandler(validCtx.req, validCtx.res, validCtx.next);
    expect(validCtx.res.status).toHaveBeenCalledWith(200);
    expect(validCtx.res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Approval history retrieved',
    }));
  });
});
