// Controller for initializing or resetting an approval workflow
// This belongs to Member 2 – Approval Workflow module only.
// It does NOT create or submit contracts – that is handled by Member 1.

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';
import { initializeOrResetApprovalWorkflow } from '../services/approval.service';
import { initializeWorkflowSchema } from '../schemas/approval.schema';

/**
 * Expected request body:
 * {
 *   "contractFormId": "<uuid>",
 *   "approverIds": ["<uuid>", "<uuid>"]
 * }
 *
 * The authenticated user is considered the submitter.
 * The service validates approvers (active, APPROVER role) and ensures the
 * contract is in DRAFT or RETURNED status before creating the workflow.
 */
export async function initializeWorkflowHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // The submitter is the authenticated user
    const submitter = req.authUser;
    if (!submitter) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    const contractFormId = (req.body as { contractFormId?: unknown })?.contractFormId;
    if (!contractFormId || typeof contractFormId !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'contractFormId is required');
    }

    // Validate approverIds payload
    const payload = initializeWorkflowSchema.safeParse({
      approverIds: (req.body as { approverIds?: unknown })?.approverIds,
    });
    if (!payload.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid workflow initialization data',
        payload.error.issues
      );
    }
    const { approverIds } = payload.data;

    // Verify the submitter actually owns the contract form
    const contract = await prisma.contractForm.findUnique({
      where: { id: contractFormId },
      select: { createdById: true },
    });
    if (!contract) {
      throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
    }
    if (contract.createdById !== submitter.id) {
      throw new AppError(403, 'FORBIDDEN', 'You are not authorized to initialize workflow for this contract');
    }

    // Run the workflow initialization inside a transaction so it can be
    // composed with the contract creation transaction on Member 1's side.
    const steps = await prisma.$transaction(async (tx) => {
      return initializeOrResetApprovalWorkflow(
        contractFormId,
        approverIds,
        submitter.id,
        tx
      );
    });

    // Return the created approval steps to the caller.
    sendSuccess(req, res, 201, 'Approval workflow initialized', { steps });
  } catch (error) {
    next(error);
  }
}
