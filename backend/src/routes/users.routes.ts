import { Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requireRoles } from '../middleware/authorize';
import { listActiveApprovers } from '../controllers/approvers.controller';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { z } from 'zod';

const router = Router();

const createUserSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'SUBMITTER', 'APPROVER']).default('SUBMITTER'),
  departmentId: z.string().uuid().nullable().optional(),
}).strict();

const updateUserSchema = z.object({
  role: z.enum(['ADMIN', 'SUBMITTER', 'APPROVER']).optional(),
  isActive: z.boolean().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  fullName: z.string().trim().min(1).max(255).optional(),
}).strict();

function parseUserInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', parsed.error.issues);
  }
  return parsed.data;
}

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
    const { fullName, email, password, role = 'SUBMITTER', departmentId = null } =
      parseUserInput(createUserSchema, req.body);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { fullName, email, passwordHash, role, departmentId },
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
    if (!z.string().uuid().safeParse(id).success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid user ID');
    }
    const { role, isActive, departmentId, fullName } =
      parseUserInput(updateUserSchema, req.body);
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
