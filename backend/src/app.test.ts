
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app';

describe('Contract Forms API', () => {
  it('should return API health status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('should return 404 for an unknown route', async () => {
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
  });

  it('should return a structured 400 for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Invalid JSON request body',
      error: { code: 'INVALID_JSON' },
      meta: { requestId: expect.any(String) },
    });
  });
});
