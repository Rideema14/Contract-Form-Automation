
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/prisma';
import { loginSchema } from './auth.validator';

const COOKIE_NAME = 'contract_token';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000,
};

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid login details',
        errors: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });

    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    const secret = process.env.JWT_SECRET;

    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must contain at least 32 characters');
    }

    const token = jwt.sign(
      { sub: user.id },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as jwt.SignOptions['expiresIn'] }
    );

    res.cookie(COOKIE_NAME, token, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
    });
  } catch (error) {
    next(error);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'Logout successful',
  });
}

export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.authUser) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.authUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account unavailable',
      });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
}
