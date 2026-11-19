import { Request, Response, NextFunction } from 'express';
import { listActiveApprovers as getActiveApprovers } from '../services/approver.service';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';

/**
 * GET /users/approvers
 * Returns a list of currently active approvers.
 * Authentication and role checks are applied via the route middleware.
 */
export async function listActiveApprovers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getActiveApprovers();
    sendSuccess(req, res, 200, 'Active approvers retrieved', { items: data });
  } catch (error) {
    next(error);
  }
}
