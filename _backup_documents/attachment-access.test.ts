import { describe, it, expect } from 'vitest';
import { createViewAccessCheck, AccessDb } from './attachment-access';

function db(opts: { createdById?: string; assigned?: boolean; missing?: boolean }): AccessDb {
  return {
    contractForm: { findUnique: async () => (opts.missing ? null : { createdById: opts.createdById ?? 'owner' }) },
    approvalStep: { findFirst: async () => (opts.assigned ? { id: 's1' } : null) },
  };
}

describe('attachment view access (same rule as getAccessibleForm)', () => {
  it('allows admin, creator and an assigned approver', async () => {
    await expect(createViewAccessCheck(db({}))('f', { id: 'x', role: 'ADMIN' })).resolves.toBeUndefined();
    await expect(createViewAccessCheck(db({}))('f', { id: 'owner', role: 'SUBMITTER' })).resolves.toBeUndefined();
    await expect(createViewAccessCheck(db({ assigned: true }))('f', { id: 'a', role: 'APPROVER' })).resolves.toBeUndefined();
  });
  it('denies other users, unassigned approvers and submitters with an approval step', async () => {
    await expect(createViewAccessCheck(db({}))('f', { id: 'x', role: 'SUBMITTER' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(createViewAccessCheck(db({}))('f', { id: 'a', role: 'APPROVER' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(createViewAccessCheck(db({ assigned: true }))('f', { id: 'a', role: 'SUBMITTER' })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('returns 404 for an unknown form', async () => {
    await expect(createViewAccessCheck(db({ missing: true }))('f', { id: 'x', role: 'ADMIN' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
