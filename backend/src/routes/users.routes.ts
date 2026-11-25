import { Request, Router } from 'express';
import authenticate from '../middleware/authenticate';
import { requireRoles } from '../middleware/authorize';
import { listActiveApprovers } from '../controllers/approvers.controller';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/app-error';
import { z } from 'zod';
import { recordAuditEvent } from '../services/audit.service';

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
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()).optional(),
  password: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().min(8).max(128).optional(),
  ),
}).strict();

function parseUserInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', parsed.error.issues);
  }
  return parsed.data;
}

function getActorId(req: Request): string {
  if (!req.authUser) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }
  return req.authUser.id;
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
    const actorId = getActorId(req);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { fullName, email, passwordHash, role, departmentId },
        select: { id: true, fullName: true, email: true, role: true, isActive: true, departmentId: true, createdAt: true },
      });
      await recordAuditEvent(tx, {
        actorId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: created.id,
        details: { role: created.role, departmentId: created.departmentId },
      });
      return created;
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
    const { role, isActive, departmentId, fullName, email, password } =
      parseUserInput(updateUserSchema, req.body);
    const actorId = getActorId(req);
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    const user = await prisma.$transaction(async (tx) => {
      const previous = await tx.user.findUnique({
        where: { id },
        select: { role: true, isActive: true, departmentId: true, fullName: true, email: true },
      });
      if (!previous) throw new AppError(404, 'NOT_FOUND', 'User not found');

      const emailChanged = email !== undefined && email !== previous.email;
      if (emailChanged) {
        const existingEmail = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (existingEmail && existingEmail.id !== id) {
          throw new AppError(409, 'DUPLICATE_EMAIL', 'A user with this email already exists', [
            { path: 'email', message: 'Email is already in use' },
          ]);
        }
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(role !== undefined ? { role } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(departmentId !== undefined ? { departmentId } : {}),
          ...(fullName !== undefined ? { fullName: fullName.trim() } : {}),
          ...(emailChanged ? { email } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
        },
        select: { id: true, fullName: true, email: true, role: true, isActive: true, departmentId: true, createdAt: true },
      });
      const changedFields = [
        ...(previous.role !== updated.role ? ['role'] : []),
        ...(previous.isActive !== updated.isActive ? ['isActive'] : []),
        ...(previous.departmentId !== updated.departmentId ? ['departmentId'] : []),
        ...(previous.fullName !== updated.fullName ? ['fullName'] : []),
        ...(emailChanged ? ['email'] : []),
        ...(passwordHash !== undefined ? ['password'] : []),
      ];
      await recordAuditEvent(tx, {
        actorId,
        action: changedFields.includes('role') ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
        entityType: 'User',
        entityId: id,
        details: {
          changedFields,
          ...(previous.role !== updated.role ? { role: { from: previous.role, to: updated.role } } : {}),
          ...(previous.isActive !== updated.isActive
            ? { isActive: { from: previous.isActive, to: updated.isActive } }
            : {}),
          ...(emailChanged ? { email: { from: previous.email, to: updated.email } } : {}),
        },
      });
      return updated;
    });
    sendSuccess(req, res, 200, 'User updated', user);
  } catch (error) {
    next(error);
  }
});

export default router;
