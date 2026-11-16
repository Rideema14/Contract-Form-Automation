import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';
import { sendError } from '../utils/response';

const COOKIE_NAME = 'contract_token';

interface AuthTokenPayload {
  sub: string;
}

export default async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    sendError(req, res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    return;
  }

  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    next(new Error('JWT_SECRET must contain at least 32 characters'));
    return;
  }

  let decoded: AuthTokenPayload;
  try {
    decoded = jwt.verify(token, secret) as AuthTokenPayload;
  } catch {
    sendError(req, res, 401, 'INVALID_AUTHENTICATION_TOKEN', 'Invalid or expired authentication token');
    return;
  }

  if (!decoded || typeof decoded !== 'object' || typeof decoded.sub !== 'string' || !decoded.sub) {
    sendError(req, res, 401, 'INVALID_AUTHENTICATION_TOKEN', 'Invalid authentication token');
    return;
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, fullName: true, email: true, isActive: true },
    });
  } catch (error) {
    next(error);
    return;
  }

  if (!user || !user.isActive) {
    sendError(req, res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    return;
  }

  req.authUser = {
    id: user.id,
    role: user.role as UserRole,
    fullName: user.fullName,
    email: user.email,
  };

  next();
}
