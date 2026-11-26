import { Request, Response } from 'express';

export function sendSuccess(
  req: Request,
  res: Response,
  statusCode: number,
  message: string,
  data: unknown,
  meta: Record<string, unknown> = {},
): void {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    meta: { requestId: req.requestId, ...meta },
  });
}

export function sendError(
  req: Request,
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details: unknown[] = [],
): void {
  res.status(statusCode).json({
    success: false,
    message,
    error: { code, details },
    meta: { requestId: req.requestId },
  });
}
