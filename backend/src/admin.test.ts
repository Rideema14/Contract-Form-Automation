import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import app from './app';
import { prisma } from './lib/prisma';

const secret = 'admin-test-secret-admin-test-secret-123';
const admin = {
  id: '00000000-0000-4000-8000-000000000001',
  role: UserRole.ADMIN,
  fullName: 'Test Admin',
  email: 'admin@example.invalid',
  isActive: true,
};
const submitter = { ...admin, role: UserRole.SUBMITTER };
const auditRow = {
  id: 'audit-1',
  actorId: admin.id,
  action: 'CONTRACT_SUBMITTED',
  entityType: 'ContractForm',
  entityId: 'form-1',
  contractFormId: 'form-1',
  details: { referenceNo: 'CF-2026-0001' },
  createdAt: new Date('2026-11-24T10:00:00.000Z'),
  actor: { fullName: admin.fullName, email: admin.email },
  contractForm: { title: 'Test contract', referenceNo: 'CF-2026-0001' },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Admin audit history route', () => {
  it('returns paginated, searchable audit history to Admins', async () => {
    vi.stubEnv('JWT_SECRET', secret);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(admin as never);
    const findMany = vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([auditRow] as never);
    vi.spyOn(prisma.auditLog, 'count').mockResolvedValue(21);
    vi.spyOn(prisma, '$transaction').mockResolvedValue([[auditRow], 21] as never);
    const token = jwt.sign({ sub: admin.id }, secret);

    const response = await request(app)
      .get('/api/admin/audit?page=2&pageSize=10&q=CF-2026')
      .set('Cookie', `contract_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items).toMatchObject([{
      action: 'CONTRACT_SUBMITTED',
      actor: { fullName: 'Test Admin' },
      contractForm: { referenceNo: 'CF-2026-0001' },
    }]);
    expect(response.body.meta.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 21,
      totalPages: 3,
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: expect.arrayContaining([
          { action: { contains: 'CF-2026', mode: 'insensitive' } },
          { entityId: { contains: 'CF-2026', mode: 'insensitive' } },
          { actor: { is: { fullName: { contains: 'CF-2026', mode: 'insensitive' } } } },
          { contractForm: { is: { referenceNo: { contains: 'CF-2026', mode: 'insensitive' } } } },
        ]),
      },
      skip: 10,
      take: 10,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }));
  });

  it('denies non-Admin access before querying audit records', async () => {
    vi.stubEnv('JWT_SECRET', secret);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(submitter as never);
    const findMany = vi.spyOn(prisma.auditLog, 'findMany');
    const token = jwt.sign({ sub: submitter.id }, secret);

    const response = await request(app)
      .get('/api/admin/audit')
      .set('Cookie', `contract_token=${token}`);

    expect(response.status).toBe(403);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('validates pagination parameters', async () => {
    vi.stubEnv('JWT_SECRET', secret);
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(admin as never);
    const findMany = vi.spyOn(prisma.auditLog, 'findMany');
    const token = jwt.sign({ sub: admin.id }, secret);

    const response = await request(app)
      .get('/api/admin/audit?page=0')
      .set('Cookie', `contract_token=${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(findMany).not.toHaveBeenCalled();
  });
});
