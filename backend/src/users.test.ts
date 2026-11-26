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
    const hash = vi.spyOn(bcrypt, 'hash').mockResolvedValue('unused-hash' as never);
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
        email: 'reviewer@example.test',
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

  it('updates only the email and leaves a blank password unchanged', async () => {
    const cookie = authCookie(adminId);
    const auditCreate = useAdminTransaction();
    const hash = vi.spyOn(bcrypt, 'hash').mockResolvedValue('unused-hash' as never);
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
        email: 'reviewer@example.test',
      } as never)
      .mockResolvedValueOnce(null as never);
    const update = vi.spyOn(prisma.user, 'update').mockResolvedValue({
      id: targetId,
      fullName: 'Reviewer',
      email: 'new-reviewer@example.test',
      role: UserRole.SUBMITTER,
      isActive: true,
      departmentId: null,
      createdAt: new Date('2026-11-24T00:00:00Z'),
    } as never);

    const response = await request(app)
      .patch(`/api/users/${targetId}`)
      .set('Cookie', cookie)
      .send({ email: ' NEW-REVIEWER@example.test ', password: '' });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: targetId },
      data: { email: 'new-reviewer@example.test' },
    }));
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(hash).not.toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: adminId,
        action: 'USER_UPDATED',
        details: expect.objectContaining({ changedFields: ['email'] }),
      }),
    });
  });

  it('rejects duplicate email addresses without updating the user', async () => {
    const cookie = authCookie(adminId);
    useAdminTransaction();
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
        email: 'reviewer@example.test',
      } as never)
      .mockResolvedValueOnce({ id: 'another-user' } as never);
    const update = vi.spyOn(prisma.user, 'update');

    const response = await request(app)
      .patch(`/api/users/${targetId}`)
      .set('Cookie', cookie)
      .send({ email: 'taken@example.test' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_EMAIL');
    expect(update).not.toHaveBeenCalled();
  });

  it('updates only a provided password using bcrypt without exposing its hash', async () => {
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
        email: 'reviewer@example.test',
      } as never);
    const hash = vi.spyOn(bcrypt, 'hash').mockResolvedValue('new-hashed-password' as never);
    const update = vi.spyOn(prisma.user, 'update').mockResolvedValue({
      id: targetId,
      fullName: 'Reviewer',
      email: 'reviewer@example.test',
      role: UserRole.SUBMITTER,
      isActive: true,
      departmentId: null,
      createdAt: new Date('2026-11-24T00:00:00Z'),
    } as never);

    const response = await request(app)
      .patch(`/api/users/${targetId}`)
      .set('Cookie', cookie)
      .send({ password: 'a-new-secret' });

    expect(response.status).toBe(200);
    expect(hash).toHaveBeenCalledWith('a-new-secret', 12);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: targetId },
      data: { passwordHash: 'new-hashed-password' },
    }));
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'USER_UPDATED',
        details: expect.objectContaining({ changedFields: ['password'] }),
      }),
    });
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('new-hashed-password');
  });

  it('updates email and password together', async () => {
    const cookie = authCookie(adminId);
    useAdminTransaction();
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
        email: 'reviewer@example.test',
      } as never)
      .mockResolvedValueOnce(null as never);
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('new-hashed-password' as never);
    const update = vi.spyOn(prisma.user, 'update').mockResolvedValue({
      id: targetId,
      fullName: 'Reviewer',
      email: 'new-reviewer@example.test',
      role: UserRole.SUBMITTER,
      isActive: true,
      departmentId: null,
      createdAt: new Date('2026-11-24T00:00:00Z'),
    } as never);

    const response = await request(app)
      .patch(`/api/users/${targetId}`)
      .set('Cookie', cookie)
      .send({ email: 'new-reviewer@example.test', password: 'a-new-secret' });

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: targetId },
      data: { email: 'new-reviewer@example.test', passwordHash: 'new-hashed-password' },
    }));
  });

  it('rejects short passwords before hashing or updating', async () => {
    const cookie = authCookie(adminId);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: adminId,
      fullName: 'Admin',
      email: 'admin@example.test',
      role: UserRole.ADMIN,
      isActive: true,
    } as never);
    const hash = vi.spyOn(bcrypt, 'hash').mockResolvedValue('unused-hash' as never);
    const update = vi.spyOn(prisma.user, 'update');

    const invalidPassword = await request(app)
      .patch(`/api/users/${targetId}`)
      .set('Cookie', cookie)
      .send({ password: 'short' });

    expect(invalidPassword.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });

  it('denies email and password updates to non-Admins', async () => {
    const cookie = authCookie(adminId);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: adminId,
      fullName: 'Submitter',
      email: 'submitter@example.test',
      role: UserRole.SUBMITTER,
      isActive: true,
    } as never);
    const hash = vi.spyOn(bcrypt, 'hash').mockResolvedValue('unused-hash' as never);
    const update = vi.spyOn(prisma.user, 'update');

    const response = await request(app)
      .patch(`/api/users/${targetId}`)
      .set('Cookie', cookie)
      .send({ email: 'new@example.test', password: 'new-password' });

    expect(response.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
    expect(hash).not.toHaveBeenCalled();
  });
});
