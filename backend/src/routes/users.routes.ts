import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requireRoles } from '../middleware/authorize';
import { listActiveApprovers } from '../controllers/approvers.controller';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';

const router = Router();

router.use(authenticate);

// GET /users/approvers
router.get('/approvers', listActiveApprovers);

router.get('/', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, fullName: true, email: true, role: true, isActive: true, departmentId: true, createdAt: true },
    });
    sendSuccess(req, res, 200, 'Users retrieved', { items: users });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const { fullName, email, password, role = 'SUBMITTER', departmentId = null } = req.body as {
      fullName?: string; email?: string; password?: string; role?: UserRole; departmentId?: string | null;
    };
    if (!fullName?.trim() || !email?.trim() || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Name, email and password are required');
    }
    if (password.length < 8) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters');
    }
    if (!Object.values(UserRole).includes(role)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid user role');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { fullName: fullName.trim(), email: email.trim().toLowerCase(), passwordHash, role, departmentId },
      select: { id: true, fullName: true, email: true, role: true, isActive: true, departmentId: true, createdAt: true },
    });
    sendSuccess(req, res, 201, 'User created', user);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requireRoles(UserRole.ADMIN), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { role, isActive, departmentId, fullName } = req.body as {
      role?: UserRole; isActive?: boolean; departmentId?: string | null; fullName?: string;
    };
    if (role !== undefined && !Object.values(UserRole).includes(role)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid user role');
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
        ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
      },
      select: { id: true, fullName: true, email: true, role: true, isActive: true, departmentId: true, createdAt: true },
    });
    sendSuccess(req, res, 200, 'User updated', user);
  } catch (error) {
    next(error);
  }
});

export default router;
