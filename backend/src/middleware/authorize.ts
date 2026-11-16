import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';

export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: { code: 'AUTHENTICATION_REQUIRED', details: [] },
        meta: { requestId: req.requestId },
      });
      return;
    }

    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to perform this action',
        error: { code: 'FORBIDDEN', details: [] },
        meta: { requestId: req.requestId },
      });
      return;
    }

    next();
  };
}
