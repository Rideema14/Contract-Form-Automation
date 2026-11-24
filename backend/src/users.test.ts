import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { UserRole } from '@prisma/client';
import app from './app';
import { prisma } from './lib/prisma';

const secret = 'test-secret-test-secret-test-secret-123';
const adminId = 'admin-1';
const targetId = '550e8400-e29b-41d4-a716-446655440001';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function authCookie(userId: string): string {
  vi.stubEnv('JWT_SECRET', secret);
  return `contract_token=${jwt.sign({ sub: userId }, secret)}`;
}

function useAdminTransaction() {
  vi.spyOn(prisma, '$transaction').mockImplementation(
    async (callback) => callback(prisma as never) as never,
  );
  return vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-1' } as never);
}

describe('admin user audit events', () => {
  it('records user creation without storing password data in the audit details', async () => {
    const cookie = authCookie(adminId);
    const auditCreate = useAdminTransaction();
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: adminId,
      fullName: 'Admin',
      email: 'admin@example.test',
      role: UserRole.ADMIN,
      isActive: true,
    } as never);
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed-secret' as never);
    vi.spyOn(prisma.user, 'create').mockResolvedValue({
      id: targetId,
      fullName: 'New Reviewer',
      email: 'reviewer@example.test',
      role: UserRole.APPROVER,
      isActive: true,
      departmentId: null,
      createdAt: new Date('2026-11-24T00:00:00Z'),
    } as never);

    const response = await request(app)
      .post('/api/users')
      .set('Cookie', cookie)
      .send({
        fullName: 'New Reviewer',
        email: 'reviewer@example.test',
        password: 'a-disposable-password',
        role: 'APPROVER',
      });

    expect(response.status).toBe(201);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: adminId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: targetId,
        details: { role: 'APPROVER', departmentId: null },
      }),
    });
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('a-disposable-password');
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('hashed-secret');
  });

  it('records role changes with before and after values', async () => {
    const cookie = authCookie(adminId);
    const auditCreate = useAdminTransaction();
    vi.spyOn(prisma.user, 'findUnique')
      .mockResolvedValueOnce({
        id: adminId,
        fullName: 'Admin',
        email: 'admin@example.test',
        role: UserRole.ADMIN,
        isActive: true,
      } as never)
      .mockResolvedValueOnce({
        role: UserRole.SUBMITTER,
        isActive: true,
        departmentId: null,
        fullName: 'Reviewer',
      } as never);
    vi.spyOn(prisma.user, 'update').mockResolvedValue({
      id: targetId,
      fullName: 'Reviewer',
      email: 'reviewer@example.test',
      role: UserRole.APPROVER,
      isActive: true,
      departmentId: null,
      createdAt: new Date('2026-11-24T00:00:00Z'),
    } as never);

    const response = await request(app)
      .patch(`/api/users/${targetId}`)
      .set('Cookie', cookie)
      .send({ role: 'APPROVER' });

    expect(response.status).toBe(200);
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: adminId,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: targetId,
        details: {
          changedFields: ['role'],
          role: { from: 'SUBMITTER', to: 'APPROVER' },
        },
      }),
    });
  });
});
