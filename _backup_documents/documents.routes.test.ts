import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { RequestHandler } from 'express';
import request from 'supertest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { InMemoryAttachmentRepository } from './attachment.types';
import { DriveStorage } from './drive.service';
import { DocumentService } from './document.service';
import { createDocumentsRouter, DocumentAccessPolicy } from './documents.routes';
import { createDocumentUpload } from './upload.middleware';
import { parseDocumentUploadConfig } from './document.config';
import type { UserRole } from '@prisma/client';

const config = parseDocumentUploadConfig({ allowedExtensions: ['pdf', 'xlsx'], maxFileSizeBytes: 1000, maxFileCount: 2 });
const PDF = 'application/pdf';

class FakeDrive implements DriveStorage {
  files = new Map<string, Buffer>();
  private n = 0;
  async upload({ body }: { name: string; mimeType: string; body: Readable }) {
    const chunks: Buffer[] = [];
    for await (const c of body) chunks.push(Buffer.from(c));
    const id = `drive-${++this.n}`;
    this.files.set(id, Buffer.concat(chunks));
    return { driveFileId: id };
  }
  async download(id: string) { return Readable.from([this.files.get(id)!]); }
  async remove(id: string) { this.files.delete(id); }
}

const authenticate: RequestHandler = (req, res, next) => {
  const header = req.header('x-user');
  if (!header) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }
  const [id, role] = header.split(':');
  req.authUser = { id, role: role as UserRole, fullName: id, email: `${id}@example.com` };
  next();
};

const access: DocumentAccessPolicy = {
  canView: async (u, contractId) => contractId === 'c1' && u.id !== 'outsider',
  canUpload: async (u, contractId) => contractId === 'c1' && u.id === 'owner',
};

let tempDir: string;
let drive: FakeDrive;
let repo: InMemoryAttachmentRepository;
function app() {
  const a = express();
  a.use('/api', createDocumentsRouter({
    service: new DocumentService({ drive, repository: repo }), access, authenticate,
    upload: createDocumentUpload({ config, tempDir }),
  }));
  return a;
}
const owner = { 'x-user': 'owner:SUBMITTER' };
const upload = (a: express.Express, name = 'quote.pdf', size = 50, headers: Record<string, string> = owner) =>
  request(a).post('/api/contracts/c1/attachments').set(headers).field('category', 'QUOTATION')
    .attach('files', Buffer.alloc(size, 'a'), { filename: name, contentType: PDF });

beforeEach(async () => { tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-routes-')); drive = new FakeDrive(); repo = new InMemoryAttachmentRepository(); });
afterEach(async () => { await fs.rm(tempDir, { recursive: true, force: true }); });

describe('documents routes', () => {
  it('uploads, lists and downloads a file', async () => {
    const a = app(); const up = await upload(a);
    expect(up.status).toBe(201);
    const { id, filename } = up.body.data[0];
    expect(filename).toBe('quote.pdf');
    expect(up.body.data[0].driveFileId).toBeUndefined();
    const list = await request(a).get('/api/contracts/c1/attachments').set({ 'x-user': 'viewer:APPROVER' });
    expect(list.body.data).toHaveLength(1);
    const dl = await request(a).get(`/api/contracts/c1/attachments/${id}/download`).set({ 'x-user': 'viewer:APPROVER' }).buffer(true);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-disposition']).toContain('attachment; filename="quote.pdf"');
    expect(dl.headers['x-content-type-options']).toBe('nosniff');
    expect(dl.body.length).toBe(50);
    const view = await request(a).get(`/api/contracts/c1/attachments/${id}/view`).set(owner);
    expect(view.headers['content-disposition']).toContain('inline');
  });
  it('renames duplicates instead of overwriting', async () => {
    const a = app(); await upload(a); const second = await upload(a);
    expect(second.body.data[0].filename).toBe('quote_1.pdf'); expect(drive.files.size).toBe(2);
  });
  it('requires authentication', async () => { expect((await request(app()).get('/api/contracts/c1/attachments')).status).toBe(401); });
  it('denies unauthorised users before any temp file is written', async () => {
    const res = await upload(app(), 'quote.pdf', 50, { 'x-user': 'outsider:SUBMITTER' });
    expect(res.status).toBe(403); expect(await fs.readdir(tempDir)).toEqual([]); expect(drive.files.size).toBe(0);
  });
  it('denies viewing for users without access', async () => {
    const res = await request(app()).get('/api/contracts/c1/attachments').set({ 'x-user': 'outsider:APPROVER' }); expect(res.status).toBe(403);
  });
  it('does not let an attachment id be used under another contract', async () => {
    const a = app(); const up = await upload(a);
    const res = await request(a).get(`/api/contracts/c2/attachments/${up.body.data[0].id}/download`).set(owner);
    expect(res.status).toBe(403);
  });
  it('returns 404 for an unknown attachment', async () => {
    const res = await request(app()).get('/api/contracts/c1/attachments/nope/download').set(owner);
    expect(res.status).toBe(404); expect(res.body.code).toBe('ATTACHMENT_NOT_FOUND');
  });
  it('rejects an invalid category and a user-uploaded FINAL_PDF', async () => {
    const a = app();
    for (const category of ['BAD', 'FINAL_PDF']) {
      const res = await request(a).post('/api/contracts/c1/attachments').set(owner).field('category', category)
        .attach('files', Buffer.alloc(10, 'a'), { filename: 'a.pdf', contentType: PDF });
      expect(res.status).toBe(400);
    }
    expect(drive.files.size).toBe(0);
  });
  it('returns upload validation errors (413, 400)', async () => {
    const a = app(); expect((await upload(a, 'big.pdf', 1001)).status).toBe(413);
    expect((await upload(a, 'a.exe')).status).toBe(400); expect(drive.files.size).toBe(0);
  });
});
