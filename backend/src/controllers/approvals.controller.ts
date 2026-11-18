
import { NextFunction, Request, Response } from 'express';

import {
  approvalStepIdParamSchema,
  approveActionSchema,
  contractHistoryParamSchema,
  pendingApprovalsQuerySchema,
  rejectActionSchema,
  returnActionSchema,
} from '../schemas/approval.schema';

import * as approvalService from '../services/approval.service';

import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';

function parse<T>(result: {
  success: boolean;
  data?: T;
  error?: { issues: unknown[] };
}): T {
  if (!result.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Validation failed',
      result.error?.issues ?? []
    );
  }

  return result.data as T;
}

function user(req: Request) {
  if (!req.authUser) {
    throw new AppError(
      401,
      'AUTHENTICATION_REQUIRED',
      'Authentication required'
    );
  }

  return req.authUser;
}

// Get pending approvals
export async function listPendingApprovals(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const query = parse(
      pendingApprovalsQuerySchema.safeParse(req.query)
    );

    const data = await approvalService.getPendingApprovals(
      user(req),
      query
    );

    sendSuccess(
      req,
      res,
      200,
      'Pending approvals retrieved',
      { items: data.items },
      { pagination: data.pagination }
    );
  } catch (error) {
    next(error);
  }
}

// Get approval step details
export async function getApprovalDetail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = parse(
      approvalStepIdParamSchema.safeParse(req.params)
    );

    const data = await approvalService.getApprovalStepDetail(
      id,
      user(req)
    );

    sendSuccess(
      req,
      res,
      200,
      'Approval details retrieved',
      data
    );
  } catch (error) {
    next(error);
  }
}

// Approve contract
export async function approveStepHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = parse(
      approvalStepIdParamSchema.safeParse(req.params)
    );

    const body = parse(
      approveActionSchema.safeParse(req.body)
    );

    const data = await approvalService.approveStep(
      id,
      user(req),
      body
    );

    sendSuccess(
      req,
      res,
      200,
      'Contract approved successfully',
      data
    );
  } catch (error) {
    next(error);
  }
}

// Return contract for changes
export async function returnStepHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = parse(
      approvalStepIdParamSchema.safeParse(req.params)
    );

    const body = parse(
      returnActionSchema.safeParse(req.body)
    );

    const data = await approvalService.returnStep(
      id,
      user(req),
      body
    );

    sendSuccess(
      req,
      res,
      200,
      'Contract returned for changes',
      data
    );
  } catch (error) {
    next(error);
  }
}

// Reject contract
export async function rejectStepHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = parse(
      approvalStepIdParamSchema.safeParse(req.params)
    );

    const body = parse(
      rejectActionSchema.safeParse(req.body)
    );

    const data = await approvalService.rejectStep(
      id,
      user(req),
      body
    );

    sendSuccess(
      req,
      res,
      200,
      'Contract rejected',
      data
    );
  } catch (error) {
    next(error);
  }
}

// Get contract approval history
export async function getApprovalHistoryHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = parse(
      contractHistoryParamSchema.safeParse(req.params)
    );

    const data = await approvalService.getApprovalHistory(
      id,
      user(req)
    );

    sendSuccess(
      req,
      res,
      200,
      'Approval history retrieved',
      data
    );
  } catch (error) {
    next(error);
  }
}
