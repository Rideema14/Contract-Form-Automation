import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'contract_token';

interface AuthTokenPayload {
  sub: string;
}

export default function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters');
    }

    const decoded = jwt.verify(token, secret) as AuthTokenPayload;

    if (!decoded.sub || typeof decoded.sub !== 'string') {
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      });
      return;
    }

    req.authUser = {
      id: decoded.sub,
      role: '',
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
    });
  }
}
