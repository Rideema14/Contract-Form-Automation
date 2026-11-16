
import { Request, Response } from 'express';

export default function notFoundHandler(
  req: Request,
  res: Response
) {
  res.status(404).json({
    success: false,
    message: 'API route not found',
    error: { code: 'NOT_FOUND', details: [] },
    meta: { requestId: req.requestId },
  });
}
