import {
  ApprovalDecisionValue,
  ApprovalStatus,
  ContractStatus,
  Prisma,
  UserRole,
  ApprovalStep,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/app-error';
import {
  ApproveActionInput,
  PendingApprovalsQuery,
  RejectActionInput,
  ReturnActionInput,
} from '../schemas/approval.schema';

export type AuthUser = {
  id: string;
  role: UserRole;
  fullName?: string;
  email?: string;
};

function assertAuthenticated(user: AuthUser | undefined): asserts user is AuthUser {
  if (!user) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }
}

/**
 * Retrieves the pending approvals queue assigned to the authenticated approver.
 * Admins can view all pending approvals across the system.
 */
export async function getPendingApprovals(
  user: AuthUser,
  query: PendingApprovalsQuery,
) {
  assertAuthenticated(user);

  if (user.role !== UserRole.APPROVER && user.role !== UserRole.ADMIN) {
    throw new AppError(403, 'FORBIDDEN', 'Only approvers and administrators can view pending approvals');
  }

  const where: Prisma.ApprovalStepWhereInput = {
    status: ApprovalStatus.PENDING,
    contractForm: {
      status: ContractStatus.PENDING_APPROVAL,
    },
    ...(user.role === UserRole.ADMIN ? {} : { approverId: user.id }),
  };

  const [items, totalItems] = await prisma.$transaction([
    prisma.approvalStep.findMany({
      where,
      orderBy: { contractForm: { createdAt: 'desc' } },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        contractForm: {
          select: {
            id: true,
            referenceNo: true,
            title: true,
            contractAmount: true,
            status: true,
            createdAt: true,
            submittedAt: true,
            createdBy: {
              select: { id: true, fullName: true, email: true },
            },
            sponsorDepartment: {
              select: { id: true, name: true },
            },
            contractCategory: {
              select: { id: true, name: true },
            },
            currency: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        approver: {
          select: { id: true, fullName: true, email: true },
        },
      },
    }),
    prisma.approvalStep.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / query.pageSize),
    },
  };
}

/**
 * Retrieves detailed information about an approval step, including full contract data,
 * cost breakdown, bidders, attachment metadata, and all decisions.
 */
export async function getApprovalStepDetail(stepId: string, user: AuthUser) {
  assertAuthenticated(user);

  const step = await prisma.approvalStep.findUnique({
    where: { id: stepId },
    include: {
      contractForm: {
        include: {
          createdBy: { select: { id: true, fullName: true, email: true, role: true } },
          sponsorDepartment: true,
          contractCategory: true,
          currency: true,
          recommendedVendor: true,
          bidders: {
            orderBy: { sortOrder: 'asc' },
            include: { vendor: true, quotations: { include: { currency: true } } },
          },
          evaluations: true,
          costLines: { orderBy: { sortOrder: 'asc' } },
          attachments: {
            select: {
              id: true,
              category: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              uploadedById: true,
              createdAt: true,
            },
          },
          approvalSteps: {
            orderBy: { level: 'asc' },
            include: {
              approver: { select: { id: true, fullName: true, email: true } },
              decisions: {
                orderBy: { createdAt: 'asc' },
                include: { actor: { select: { id: true, fullName: true, email: true } } },
              },
            },
          },
        },
      },
      approver: { select: { id: true, fullName: true, email: true } },
      decisions: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      },
    },
  });

  if (!step) {
    throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval step not found');
  }

  const isAuthorized =
    user.role === UserRole.ADMIN ||
    step.approverId === user.id ||
    step.contractForm.createdById === user.id ||
    step.contractForm.approvalSteps.some((s) => s.approverId === user.id);

  if (!isAuthorized) {
    throw new AppError(403, 'FORBIDDEN', 'You are not authorized to view this approval step');
  }

  return step;
}

/**
 * Retrieves complete approval history and workflow audit trail for a contract form.
 */
export async function getApprovalHistory(contractFormId: string, user: AuthUser) {
  assertAuthenticated(user);

  const form = await prisma.contractForm.findUnique({
    where: { id: contractFormId },
    include: {
      approvalSteps: {
        orderBy: { level: 'asc' },
        include: {
          approver: { select: { id: true, fullName: true, email: true } },
          decisions: {
            orderBy: { createdAt: 'asc' },
            include: { actor: { select: { id: true, fullName: true, email: true } } },
          },
        },
      },
      approvalDecisions: {
        orderBy: { createdAt: 'asc' },
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      },
      auditLogs: {
        where: {
          action: {
            in: [
              'CONTRACT_SUBMITTED',
              'CONTRACT_RESUBMITTED',
              'APPROVAL_STEP_APPROVED',
              'CONTRACT_FINAL_APPROVED',
              'CONTRACT_RETURNED',
              'CONTRACT_REJECTED',
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  });

  if (!form) {
    throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
  }

  const isAuthorized =
    user.role === UserRole.ADMIN ||
    form.createdById === user.id ||
    form.approvalSteps.some((s) => s.approverId === user.id);

  if (!isAuthorized) {
    throw new AppError(403, 'FORBIDDEN', 'You are not authorized to view the approval history for this contract');
  }

  return {
    contractFormId: form.id,
    referenceNo: form.referenceNo,
    title: form.title,
    status: form.status,
    approvalSteps: form.approvalSteps,
    decisions: form.approvalDecisions,
    auditTrail: form.auditLogs,
  };
}

/**
 * Concurrency-safe atomic approval action.
 * Strict assignment check: Only the approver assigned to the currently pending step can approve.
 * Advances to the next sequential active step or marks the contract as APPROVED if this was the final step.
 */
export async function approveStep(
  stepId: string,
  user: AuthUser,
  input: ApproveActionInput = {},
) {
  assertAuthenticated(user);

  return prisma.$transaction(async (tx) => {
    // 1. Initial existence and authorization check
    const step = await tx.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        contractForm: {
          select: {
            id: true,
            title: true,
            referenceNo: true,
            status: true,
            createdById: true,
          },
        },
      },
    });

    if (!step) {
      throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval step not found');
    }

    // Strict rule: Only the assigned approver can approve (no Admin bypass)
    if (step.approverId !== user.id) {
      throw new AppError(403, 'NOT_ASSIGNED_APPROVER', 'You are not the assigned approver for this step');
    }

    if (step.status !== ApprovalStatus.PENDING || step.contractForm.status !== ContractStatus.PENDING_APPROVAL) {
      throw new AppError(409, 'STEP_NOT_PENDING', 'Approval step is not currently pending');
    }

    const now = new Date();

    // 2. ATOMIC CONDITIONAL UPDATE:
    // Guards against race conditions and concurrent requests.
    // If a simultaneous request already acted on this step, updateMany returns count === 0.
    const updateResult = await tx.approvalStep.updateMany({
      where: {
        id: stepId,
        approverId: user.id,
        status: ApprovalStatus.PENDING,
        contractFormId: step.contractFormId,
        contractForm: {
          status: ContractStatus.PENDING_APPROVAL,
        },
      },
      data: {
        status: ApprovalStatus.APPROVED,
        actedAt: now,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(409, 'STEP_NOT_PENDING', 'Approval step was already decided or is no longer pending');
    }

    // 3. Create append-only ApprovalDecision record
    const decision = await tx.approvalDecision.create({
      data: {
        approvalStepId: step.id,
        contractFormId: step.contractFormId,
        actorId: user.id,
        decision: ApprovalDecisionValue.APPROVED,
        comment: input.comment?.trim() || null,
        createdAt: now,
      },
    });

    // 4. Sequential Workflow Progression: Find next level in the ACTIVE workflow chain.
    // Active waiting steps must have status: WAITING and actedAt: null.
    // Surplus steps from past cycles do not match this criteria.
    const nextStep = await tx.approvalStep.findFirst({
      where: {
        contractFormId: step.contractFormId,
        level: step.level + 1,
        status: ApprovalStatus.WAITING,
        actedAt: null,
      },
    });

    let nextStepSummary: { level: number; approverId: string; status: ApprovalStatus } | null = null;
    let finalContractStatus: ContractStatus = ContractStatus.PENDING_APPROVAL;

    if (nextStep) {
      // Intermediate step: Activate next level
      await tx.approvalStep.update({
        where: { id: nextStep.id },
        data: { status: ApprovalStatus.PENDING },
      });

      nextStepSummary = {
        level: nextStep.level,
        approverId: nextStep.approverId,
        status: ApprovalStatus.PENDING,
      };

      // Notify next assigned approver
      const formIdentifier = step.contractForm.referenceNo || step.contractForm.title || 'Contract form';
      await tx.notification.create({
        data: {
          recipientId: nextStep.approverId,
          contractFormId: step.contractFormId,
          message: `${formIdentifier} requires your approval (Level ${nextStep.level}).`,
        },
      });

      // Audit log entry for step progression
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'APPROVAL_STEP_APPROVED',
          entityType: 'ApprovalStep',
          entityId: step.id,
          contractFormId: step.contractFormId,
          details: {
            stepId: step.id,
            level: step.level,
            decision: 'APPROVED',
            comment: input.comment?.trim() || null,
            nextLevelActivated: nextStep.level,
            nextApproverId: nextStep.approverId,
          },
        },
      });
    } else {
      // Final step of the active chain: Mark contract as APPROVED
      finalContractStatus = ContractStatus.APPROVED;
      await tx.contractForm.update({
        where: { id: step.contractFormId },
        data: { status: ContractStatus.APPROVED },
      });

      // Notify contract creator of final approval
      const formIdentifier = step.contractForm.referenceNo || step.contractForm.title || 'Your contract form';
      await tx.notification.create({
        data: {
          recipientId: step.contractForm.createdById,
          contractFormId: step.contractFormId,
          message: `${formIdentifier} has received final approval and is now APPROVED.`,
        },
      });

      // Audit log entry for final contract approval
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: 'CONTRACT_FINAL_APPROVED',
          entityType: 'ContractForm',
          entityId: step.contractFormId,
          contractFormId: step.contractFormId,
          details: {
            finalStepId: step.id,
            finalLevel: step.level,
            decision: 'APPROVED',
            comment: input.comment?.trim() || null,
          },
        },
      });
    }

    return {
      stepId: step.id,
      level: step.level,
      status: ApprovalStatus.APPROVED,
      contractFormId: step.contractFormId,
      contractStatus: finalContractStatus,
      decision,
      nextStep: nextStepSummary,
    };
  });
}

/**
 * Concurrency-safe atomic return action.
 * Strict assignment check: Only the approver assigned to the currently pending step can return.
 * Requires a mandatory comment. Changes step and contract form to RETURNED status.
 */
export async function returnStep(
  stepId: string,
  user: AuthUser,
  input: ReturnActionInput,
) {
  assertAuthenticated(user);

  const comment = input.comment?.trim();
  if (!comment) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Comment is required when returning a contract', [
      { path: ['comment'], message: 'Comment is required when returning a contract' },
    ]);
  }

  return prisma.$transaction(async (tx) => {
    const step = await tx.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        contractForm: {
          select: {
            id: true,
            title: true,
            referenceNo: true,
            status: true,
            createdById: true,
          },
        },
      },
    });

    if (!step) {
      throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval step not found');
    }

    // Strict rule: Only the assigned approver can return (no Admin bypass)
    if (step.approverId !== user.id) {
      throw new AppError(403, 'NOT_ASSIGNED_APPROVER', 'You are not the assigned approver for this step');
    }

    if (step.status !== ApprovalStatus.PENDING || step.contractForm.status !== ContractStatus.PENDING_APPROVAL) {
      throw new AppError(409, 'STEP_NOT_PENDING', 'Approval step is not currently pending');
    }

    const now = new Date();

    // Atomic conditional update
    const updateResult = await tx.approvalStep.updateMany({
      where: {
        id: stepId,
        approverId: user.id,
        status: ApprovalStatus.PENDING,
        contractFormId: step.contractFormId,
        contractForm: {
          status: ContractStatus.PENDING_APPROVAL,
        },
      },
      data: {
        status: ApprovalStatus.RETURNED,
        actedAt: now,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(409, 'STEP_NOT_PENDING', 'Approval step was already decided or is no longer pending');
    }

    // Append-only decision record
    const decision = await tx.approvalDecision.create({
      data: {
        approvalStepId: step.id,
        contractFormId: step.contractFormId,
        actorId: user.id,
        decision: ApprovalDecisionValue.RETURNED,
        comment,
        createdAt: now,
      },
    });

    // Update contract status to RETURNED
    await tx.contractForm.update({
      where: { id: step.contractFormId },
      data: { status: ContractStatus.RETURNED },
    });

    // Notify contract creator with approver's remarks
    const formIdentifier = step.contractForm.referenceNo || step.contractForm.title || 'Your contract form';
    await tx.notification.create({
      data: {
        recipientId: step.contractForm.createdById,
        contractFormId: step.contractFormId,
        message: `${formIdentifier} was returned for modifications (Level ${step.level}): ${comment}`,
      },
    });

    // Audit log entry
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CONTRACT_RETURNED',
        entityType: 'ContractForm',
        entityId: step.contractFormId,
        contractFormId: step.contractFormId,
        details: {
          stepId: step.id,
          level: step.level,
          decision: 'RETURNED',
          comment,
        },
      },
    });

    return {
      stepId: step.id,
      level: step.level,
      status: ApprovalStatus.RETURNED,
      contractFormId: step.contractFormId,
      contractStatus: ContractStatus.RETURNED,
      decision,
    };
  });
}

/**
 * Concurrency-safe atomic reject action.
 * Strict assignment check: Only the approver assigned to the currently pending step can reject.
 * Requires a mandatory comment. Terminates the workflow by marking the contract and step as REJECTED.
 */
export async function rejectStep(
  stepId: string,
  user: AuthUser,
  input: RejectActionInput,
) {
  assertAuthenticated(user);

  const comment = input.comment?.trim();
  if (!comment) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Comment is required when rejecting a contract', [
      { path: ['comment'], message: 'Comment is required when rejecting a contract' },
    ]);
  }

  return prisma.$transaction(async (tx) => {
    const step = await tx.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        contractForm: {
          select: {
            id: true,
            title: true,
            referenceNo: true,
            status: true,
            createdById: true,
          },
        },
      },
    });

    if (!step) {
      throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval step not found');
    }

    // Strict rule: Only the assigned approver can reject (no Admin bypass)
    if (step.approverId !== user.id) {
      throw new AppError(403, 'NOT_ASSIGNED_APPROVER', 'You are not the assigned approver for this step');
    }

    if (step.status !== ApprovalStatus.PENDING || step.contractForm.status !== ContractStatus.PENDING_APPROVAL) {
      throw new AppError(409, 'STEP_NOT_PENDING', 'Approval step is not currently pending');
    }

    const now = new Date();

    // Atomic conditional update
    const updateResult = await tx.approvalStep.updateMany({
      where: {
        id: stepId,
        approverId: user.id,
        status: ApprovalStatus.PENDING,
        contractFormId: step.contractFormId,
        contractForm: {
          status: ContractStatus.PENDING_APPROVAL,
        },
      },
      data: {
        status: ApprovalStatus.REJECTED,
        actedAt: now,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(409, 'STEP_NOT_PENDING', 'Approval step was already decided or is no longer pending');
    }

    // Cancel any remaining subsequent waiting steps in the active chain
    await tx.approvalStep.updateMany({
      where: {
        contractFormId: step.contractFormId,
        level: { gt: step.level },
        status: ApprovalStatus.WAITING,
        actedAt: null,
      },
      data: {
        status: ApprovalStatus.REJECTED,
      },
    });

    // Append-only decision record
    const decision = await tx.approvalDecision.create({
      data: {
        approvalStepId: step.id,
        contractFormId: step.contractFormId,
        actorId: user.id,
        decision: ApprovalDecisionValue.REJECTED,
        comment,
        createdAt: now,
      },
    });

    // Update contract status to REJECTED (terminal state)
    await tx.contractForm.update({
      where: { id: step.contractFormId },
      data: { status: ContractStatus.REJECTED },
    });

    // Notify contract creator of rejection
    const formIdentifier = step.contractForm.referenceNo || step.contractForm.title || 'Your contract form';
    await tx.notification.create({
      data: {
        recipientId: step.contractForm.createdById,
        contractFormId: step.contractFormId,
        message: `${formIdentifier} was rejected at Level ${step.level}: ${comment}`,
      },
    });

    // Audit log entry
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'CONTRACT_REJECTED',
        entityType: 'ContractForm',
        entityId: step.contractFormId,
        contractFormId: step.contractFormId,
        details: {
          stepId: step.id,
          level: step.level,
          decision: 'REJECTED',
          comment,
        },
      },
    });

    return {
      stepId: step.id,
      level: step.level,
      status: ApprovalStatus.REJECTED,
      contractFormId: step.contractFormId,
      contractStatus: ContractStatus.REJECTED,
      decision,
    };
  });
}

/**
 * Workflow Initialization and Resubmission Helper.
 * Can be called during contract submission (Member 1 integration).
 * Accepts `tx: Prisma.TransactionClient` to participate seamlessly in parent submit transactions.
 *
 * Rules Enforced:
 * 1. Contract status guard: Only DRAFT and RETURNED contracts can be submitted (HTTP 409 for invalid states).
 * 2. Approver list validation: Disallows empty lists (HTTP 400) and duplicate approvers (HTTP 400).
 * 3. Shortened chain handling: Surplus steps from prior cycles are deleted if they have no decisions,
 *    or kept inert without WAITING/actedAt=null status to preserve decision history.
 * 4. Resubmissions restart strictly from Level 1, activating only Level 1 as PENDING.
 */
export async function initializeOrResetApprovalWorkflow(
  contractFormId: string,
  approverIds: string[],
  submitterId: string,
  tx: Prisma.TransactionClient,
): Promise<ApprovalStep[]> {
  // 1. Validate non-empty approver list
  if (!approverIds || approverIds.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one approver must be assigned to initiate workflow', [
      { path: ['approverIds'], message: 'At least one approver must be assigned' },
    ]);
  }

  // 2. Validate no duplicate approver IDs in the chain
  const uniqueApproverIds = new Set(approverIds);
  if (uniqueApproverIds.size !== approverIds.length) {
    throw new AppError(400, 'DUPLICATE_APPROVER', 'Approver list cannot contain duplicate approvers', [
      { path: ['approverIds'], message: 'Duplicate approver IDs are not allowed in the approval chain' },
    ]);
  }

  // 3. Contract status guard: check form existence and editable status (participates in caller's tx)
  const form = await tx.contractForm.findUnique({
    where: { id: contractFormId },
    select: { id: true, title: true, referenceNo: true, status: true },
  });

  if (!form) {
    throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
  }

  const allowedStatuses: ContractStatus[] = [ContractStatus.DRAFT, ContractStatus.RETURNED];
  if (!allowedStatuses.includes(form.status)) {
    throw new AppError(
      409,
      'INVALID_STATE',
      `Only draft or returned contracts can be submitted for approval. Current status: ${form.status}`,
    );
  }

  // 4. Validate that all approvers exist and are active
  const approvers = await tx.user.findMany({
    where: {
      id: { in: approverIds },
      isActive: true,
    },
    select: { id: true, role: true },
  });

  if (approvers.length !== approverIds.length) {
    throw new AppError(400, 'INVALID_APPROVER', 'One or more assigned approvers do not exist or are inactive');
  }

  // 5. Fetch existing steps for this form
  const existingSteps = await tx.approvalStep.findMany({
    where: { contractFormId },
    orderBy: { level: 'asc' },
  });

  const now = new Date();
  const resultSteps: ApprovalStep[] = [];

  if (existingSteps.length > 0) {
    // Resubmission case:
    // Update or create active levels 1..approverIds.length
    for (let i = 0; i < approverIds.length; i++) {
      const level = i + 1;
      const approverId = approverIds[i];
      const existingStep = existingSteps.find((s) => s.level === level);

      if (existingStep) {
        const updated = await tx.approvalStep.update({
          where: { id: existingStep.id },
          data: {
            approverId,
            status: level === 1 ? ApprovalStatus.PENDING : ApprovalStatus.WAITING,
            actedAt: null, // Reset actedAt for the new active cycle
          },
        });
        resultSteps.push(updated);
      } else {
        const created = await tx.approvalStep.create({
          data: {
            contractFormId,
            level,
            approverId,
            status: level === 1 ? ApprovalStatus.PENDING : ApprovalStatus.WAITING,
            actedAt: null,
          },
        });
        resultSteps.push(created);
      }
    }

    // Handle surplus levels above approverIds.length (shortened approval chain):
    if (existingSteps.length > approverIds.length) {
      for (let i = approverIds.length; i < existingSteps.length; i++) {
        const surplusStep = existingSteps[i];
        const hasDecisions = await tx.approvalDecision.findFirst({
          where: { approvalStepId: surplusStep.id },
        });

        if (!hasDecisions) {
          // No decisions exist: safe to delete without foreign key violation or history loss
          await tx.approvalStep.delete({ where: { id: surplusStep.id } });
        } else {
          // Decisions exist: preserve row to maintain foreign keys and audit history.
          // CRITICAL: Ensure status is NOT WAITING and actedAt is NOT null so that
          // approveStep (which looks for WAITING with actedAt=null) will never activate it.
          if (surplusStep.status === ApprovalStatus.WAITING || surplusStep.status === ApprovalStatus.PENDING) {
            await tx.approvalStep.update({
              where: { id: surplusStep.id },
              data: { status: ApprovalStatus.RETURNED },
            });
          }
        }
      }
    }
  } else {
    // Initial submission: create fresh sequential steps
    for (let i = 0; i < approverIds.length; i++) {
      const level = i + 1;
      const approverId = approverIds[i];
      const created = await tx.approvalStep.create({
        data: {
          contractFormId,
          level,
          approverId,
          status: level === 1 ? ApprovalStatus.PENDING : ApprovalStatus.WAITING,
          actedAt: null,
        },
      });
      resultSteps.push(created);
    }
  }

  // 6. Atomic update of ContractForm status (verifies status is still in allowedStatuses)
  const updateFormResult = await tx.contractForm.updateMany({
    where: {
      id: contractFormId,
      status: { in: allowedStatuses },
    },
    data: {
      status: ContractStatus.PENDING_APPROVAL,
      submittedAt: now,
    },
  });

  if (updateFormResult.count === 0) {
    throw new AppError(409, 'INVALID_STATE', 'Contract status was concurrently modified or is not editable');
  }

  // 7. Notify Level 1 approver
  const formIdentifier = form.referenceNo || form.title || 'Contract form';
  await tx.notification.create({
    data: {
      recipientId: approverIds[0],
      contractFormId,
      message: `${formIdentifier} has been submitted and is pending your approval (Level 1).`,
    },
  });

  // 8. Audit log entry for submission / resubmission
  await tx.auditLog.create({
    data: {
      actorId: submitterId,
      action: existingSteps.length > 0 ? 'CONTRACT_RESUBMITTED' : 'CONTRACT_SUBMITTED',
      entityType: 'ContractForm',
      entityId: contractFormId,
      contractFormId,
      details: {
        levelsCount: approverIds.length,
        level1ApproverId: approverIds[0],
        resubmission: existingSteps.length > 0,
      },
    },
  });

  return resultSteps;
}
