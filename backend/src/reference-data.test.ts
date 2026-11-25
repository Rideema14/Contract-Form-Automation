import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from './app';
import { prisma } from './lib/prisma';
import { UserRole } from '@prisma/client';

const secret = 'test-secret-test-secret-test-secret-123';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('reference data access', () => {
  function adminCookie() {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'admin-1',
      fullName: 'Admin',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      isActive: true,
    } as never);
    const token = jwt.sign({ sub: 'admin-1' }, secret);
    return `contract_token=${token}`;
  }

  it('rejects unauthenticated direct mutation requests', async () => {
    const response = await request(app)
      .post('/api/reference-data/departments')
      .send({ name: 'Finance' });

    expect(response.status).toBe(401);
  });

  it('rejects submitter mutation requests', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'submitter-1',
      fullName: 'Submitter',
      email: 'submitter@example.com',
      role: UserRole.SUBMITTER,
      isActive: true,
    } as never);
    const token = jwt.sign({ sub: 'submitter-1' }, secret);

    const response = await request(app)
      .post('/api/reference-data/departments')
      .set('Cookie', `contract_token=${token}`)
      .send({ name: 'Finance' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects approver mutation requests', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: 'approver-1',
      fullName: 'Approver',
      email: 'approver@example.com',
      role: UserRole.APPROVER,
      isActive: true,
    } as never);
    const token = jwt.sign({ sub: 'approver-1' }, secret);

    const response = await request(app)
      .delete('/api/reference-data/departments/depart-1')
      .set('Cookie', `contract_token=${token}`);

    expect(response.status).toBe(403);
  });

  it('creates vendors from structured contact fields and keeps the selected type relationship', async () => {
    const cookie = adminCookie();
    const vendorTypeId = '550e8400-e29b-41d4-a716-446655440001';
    const contactDetails = {
      contactPerson: 'A. Person',
      email: 'person@example.com',
      phone: '+1-555-0101',
      qualifications: 'ISO 9001',
    };
    vi.spyOn(prisma.vendor, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.vendorType, 'findUnique').mockResolvedValue({
      id: vendorTypeId,
      name: 'Technology Services',
    } as never);
    const create = vi.spyOn(prisma.vendor, 'create').mockResolvedValue({
      id: 'vendor-1',
      name: 'Acme Systems',
      vendorType: { id: vendorTypeId, name: 'Technology Services' },
      contactDetails,
    } as never);

    const response = await request(app)
      .post('/api/reference-data/vendors')
      .set('Cookie', cookie)
      .send({ name: 'Acme Systems', vendorTypeId, contactDetails });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'Acme Systems',
      vendorType: { id: vendorTypeId, name: 'Technology Services' },
      contactDetails,
    });
    expect(create).toHaveBeenCalledWith({
      data: { name: 'Acme Systems', vendorTypeId, contactDetails },
      select: { id: true, name: true, vendorType: { select: { id: true, name: true } }, contactDetails: true },
    });
  });

  it('updates a vendor in place with its existing ID and vendor type relationship', async () => {
    const cookie = adminCookie();
    const vendorTypeId = '550e8400-e29b-41d4-a716-446655440001';
    const id = '550e8400-e29b-41d4-a716-446655440002';
    const contactDetails = {
      contactPerson: 'New Contact',
      email: 'new@example.com',
      phone: '+1-555-0101',
      qualifications: 'Updated experience',
    };
    vi.spyOn(prisma.vendor, 'findMany').mockResolvedValue([{ id: 'another-vendor', name: 'Another Company' }] as never);
    vi.spyOn(prisma.vendorType, 'findUnique').mockResolvedValue({
      id: vendorTypeId,
      name: 'Technology Services',
    } as never);
    const update = vi.spyOn(prisma.vendor, 'update').mockResolvedValue({
      id,
      name: 'Updated Company',
      vendorType: { id: vendorTypeId, name: 'Technology Services' },
      contactDetails,
    } as never);

    const response = await request(app)
      .patch(`/api/reference-data/vendors/${id}`)
      .set('Cookie', cookie)
      .send({ name: 'Updated Company', vendorTypeId, contactDetails });

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(id);
    expect(response.body.data.vendorType.id).toBe(vendorTypeId);
    expect(update).toHaveBeenCalledWith({
      where: { id },
      data: { name: 'Updated Company', vendorTypeId, contactDetails },
      select: { id: true, name: true, vendorType: { select: { id: true, name: true } }, contactDetails: true },
    });
  });

  it('returns vendor type names and vendors for the Contract Form reference-data dropdown', async () => {
    const cookie = adminCookie();
    vi.spyOn(prisma.department, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.contractCategory, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.currency, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.vendorType, 'findMany').mockResolvedValue([
      { id: 'vendor-type-id', name: 'Technology Services' },
    ] as never);
    vi.spyOn(prisma.vendor, 'findMany').mockResolvedValue([
      {
        id: 'vendor-id',
        name: 'Acme Systems',
        vendorType: { id: 'vendor-type-id', name: 'Technology Services' },
        contactDetails: { email: 'contact@example.com' },
      },
    ] as never);

    const response = await request(app)
      .get('/api/reference-data')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.data.vendorTypes).toEqual([
      { id: 'vendor-type-id', name: 'Technology Services' },
    ]);
    expect(response.body.data.vendors).toEqual([
      expect.objectContaining({
        id: 'vendor-id',
        name: 'Acme Systems',
        vendorType: { id: 'vendor-type-id', name: 'Technology Services' },
      }),
    ]);
  });

  it('prevents deleting vendor types used by contract bidders', async () => {
    const cookie = adminCookie();
    const vendorTypeId = '550e8400-e29b-41d4-a716-446655440001';
    vi.spyOn(prisma.vendor, 'count').mockResolvedValue(0);
    const bidderCount = vi.spyOn(prisma.bidder, 'count').mockResolvedValue(1);
    const deleteVendorType = vi.spyOn(prisma.vendorType, 'delete');

    const response = await request(app)
      .delete(`/api/reference-data/vendor-types/${vendorTypeId}`)
      .set('Cookie', cookie);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('REFERENCE_DATA_IN_USE');
    expect(bidderCount).toHaveBeenCalledWith({ where: { vendorTypeId } });
    expect(deleteVendorType).not.toHaveBeenCalled();
  });

  it('rejects duplicate vendor names without creating another vendor', async () => {
    const cookie = adminCookie();
    const findMany = vi.spyOn(prisma.vendor, 'findMany').mockResolvedValue([
      { id: 'existing-vendor', name: 'Acme Systems' },
    ] as never);
    const create = vi.spyOn(prisma.vendor, 'create');

    const response = await request(app)
      .post('/api/reference-data/vendors')
      .set('Cookie', cookie)
      .send({
        name: '  ACME SYSTEMS ',
        vendorTypeId: '550e8400-e29b-41d4-a716-446655440001',
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_REFERENCE_DATA');
    expect(findMany).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects invalid vendor email and phone values', async () => {
    const cookie = adminCookie();
    vi.spyOn(prisma.vendor, 'findMany').mockResolvedValue([] as never);
    vi.spyOn(prisma.vendorType, 'findUnique').mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Technology Services',
    } as never);
    const create = vi.spyOn(prisma.vendor, 'create');

    for (const contactDetails of [
      { email: 'not-an-email', phone: '+1-555-0101' },
      { email: 'valid@example.com', phone: '123' },
    ]) {
      const response = await request(app)
        .post('/api/reference-data/vendors')
        .set('Cookie', cookie)
        .send({
          name: 'Acme Systems',
          vendorTypeId: '550e8400-e29b-41d4-a716-446655440001',
          contactDetails,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(create).not.toHaveBeenCalled();
  });
});
