import { describe, expect, it, afterEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import app from './app';
import { prisma } from './lib/prisma';

const secret = 'test-secret-test-secret-test-secret-123';
const activeUser = {
  id: '00000000-0000-0000-0000-000000000001',
  fullName: 'Test Submitter',
  email: 'submitter@example.com',
  passwordHash: 'hashed-password',
  role: UserRole.SUBMITTER,
  isActive: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('authentication', () => {
  it('logs in successfully and sets an HttpOnly cookie', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(activeUser as never);
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: activeUser.email, password: 'correct-password' });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe(UserRole.SUBMITTER);
    expect(response.headers['set-cookie'][0]).toContain('contract_token=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('rejects an incorrect password', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(activeUser as never);
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: activeUser.email, password: 'wrong-password' });

    expect(response.status).toBe(401);
  });

  it('rejects an unknown email', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'password' });

    expect(response.status).toBe(401);
  });

  it('returns a structured error for a missing token', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'AUTHENTICATION_REQUIRED' },
      meta: { requestId: expect.any(String) },
    });
  });

  it('rejects invalid and expired tokens without exposing token contents', async () => {
    const invalid = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'contract_token=not-a-jwt');
    const expiredToken = jwt.sign({ sub: activeUser.id }, secret, { expiresIn: -1 });
    const expired = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `contract_token=${expiredToken}`);

    for (const response of [invalid, expired]) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_AUTHENTICATION_TOKEN');
      expect(response.body).not.toHaveProperty('token');
    }
  });

  it('rejects an inactive user', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ ...activeUser, isActive: false } as never);
    const token = jwt.sign({ sub: activeUser.id }, secret);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `contract_token=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('passes database lookup failures to the global error handler', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockRejectedValue(new Error('database unavailable'));
    const token = jwt.sign({ sub: activeUser.id }, secret);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `contract_token=${token}`);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
      meta: { requestId: expect.any(String) },
    });
    expect(response.body.error.code).not.toBe('AUTHENTICATION_REQUIRED');
  });

  it('loads the authenticated user and populates the database role', async () => {
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      ...activeUser,
      role: UserRole.APPROVER,
    } as never);
    const token = jwt.sign({ sub: activeUser.id }, secret);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `contract_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe(UserRole.APPROVER);
  });

  it('clears the authentication cookie on logout', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Logout successful');
    expect(response.headers['set-cookie'][0]).toContain('contract_token=;');
  });
});
