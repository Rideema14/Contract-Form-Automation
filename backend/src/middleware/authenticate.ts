
import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import prisma from '../config/prisma';

const COOKIE_NAME = 'contract_token';

export default async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (typeof decoded.sub !== 'string') {
      res.status(401).json({
        success: false,
        message: 'Invalid authentication token',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        isActive: true,
        role: {
          select: { name: true },
        },
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account is inactive or unavailable',
      });
      return;
    }

    req.authUser = {
      id: user.id,
      role: user.role.name,
    };

    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token',
    });
  }
}
