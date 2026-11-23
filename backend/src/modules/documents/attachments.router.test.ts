import { describe, it, expect, beforeEach } from 'vitest';
import express, { ErrorRequestHandler, RequestHandler } from 'express';
import request from 'supertest';
import { Readable } from 'node:stream';
import { AppError } from '../../utils/app-error';
import { InMemoryAttachmentRepository } from './attachment.types';
import { createAttachmentsRouter } from './attachments.router';
import { parseDocumentUploadConfig } from './document.config';
import { DocumentService } from './document.service';
import { DriveStorage } from './drive.service';
import { createDocumentUploadMiddleware, documentUploadErrorHandler } from './upload.middleware';

// Test-only values, NOT project decisions (CL-14).
const config = parseDocumentUploadConfig({ allowedExtensions: ['pdf', 'xlsx'], maxFileSizeBytes: 1000, maxFileCount: 2 });
const PDF = 'application/pdf';
const FORM = '11111111-1111-4111-8111-111111111111';
const OTHER_FORM = '22222222-2222-4222-8222-222222222222';

class FakeDrive implements DriveStorage {
  files = new Map<string, Buffer>();
  folderNames: string[] = [];
  private n = 0;
  async upload({ body, contractFolderName }: Parameters<DriveStorage['upload']>[0]) {
    const chunks: Buffer[] = [];
    for await (const c of body) chunks.push(Buffer.from(c));
    const id = `drive-${++this.n}`;
    this.folderNames.push(contractFolderName);
    this.files.set(id, Buffer.concat(chunks));
    return { driveFileId: id };
  }
  async download(id: string) { return Readable.from([this.files.get(id)!]); }
  async remove(id: string) { this.files.delete(id); }
}

// header "x-user: id:ROLE"
const authenticate: RequestHandler = (req, res, next) => {
  const h = req.header('x-user');
  if (!h) { res.status(401).json({ success: false, message: 'Authentication required' }); return; }
  const [id, role] = h.split(':');
  req.authUser = { id, role } as never;
  next();
};

const appErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message, error: { code: err.code, details: err.details } });
    return;
  }
  next(err);
};

let drive: FakeDrive;
let packageCalls: string[];

function app() {
  drive = new FakeDrive();
  packageCalls = [];
  const service = new DocumentService({ drive, repository: new InMemoryAttachmentRepository() });
  const a = express();
  a.use(
    '/api/forms',
    createAttachmentsRouter({
      service,
      authenticate,
      // creator = "owner" and form must be FORM; others are denied
      assertCanUpload: async (formId, user) => {
        if (formId !== FORM) throw new AppError(404, 'FORM_NOT_FOUND', 'Contract form not found');
        if (user.id !== 'owner') throw new AppError(403, 'FORBIDDEN', 'not allowed');
      },
      assertCanView: async (formId, user) => {
        if (formId !== FORM) throw new AppError(403, 'FORBIDDEN', 'not allowed');
        if (user.id === 'outsider') throw new AppError(403, 'FORBIDDEN', 'not allowed');
      },
      getContractFolderName: async () => 'CF-2026-0001 - Office Renovation - 11111111',
      upload: createDocumentUploadMiddleware(config, 'files'),
      generatePackage: async (formId) => {
        packageCalls.push(formId);
        return {
          fileName: 'Contract_CF-1_Full_Package.zip',
          content: Buffer.from('zip-content'),
        };
      },
    })
  );
  a.use(documentUploadErrorHandler);
  a.use(appErrors);
  return a;
}

const owner = { 'x-user': 'owner:SUBMITTER' };
const upload = (a: express.Express, o: { name?: string; size?: number; category?: string; headers?: Record<string, string>; form?: string } = {}) =>
  request(a)
    .post(`/api/forms/${o.form ?? FORM}/attachments`)
    .set(o.headers ?? owner)
    .field('category', o.category ?? 'SUPPORTING')
    .attach('files', Buffer.alloc(o.size ?? 50, 'a'), { filename: o.name ?? 'quote.pdf', contentType: PDF });

beforeEach(() => undefined);

describe('attachments router', () => {
  it('uploads, lists and downloads a file; Drive ids are never exposed', async () => {
    const a = app();
    const up = await upload(a);
    expect(up.status).toBe(201);
    const item = up.body.data[0];
    expect(item).toMatchObject({ fileName: 'quote.pdf', category: 'SUPPORTING', mimeType: PDF, uploadedById: 'owner' });
    expect(item.driveFileId).toBeUndefined();
    expect(drive.files.size).toBe(1);
    expect(drive.folderNames).toEqual(['CF-2026-0001 - Office Renovation - 11111111']);

    const list = await request(a).get(`/api/forms/${FORM}/attachments`).set({ 'x-user': 'viewer:APPROVER' });
    expect(list.body.data).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain('drive-');

    for (const headers of [owner, { 'x-user': 'viewer:APPROVER' }, { 'x-user': 'admin:ADMIN' }]) {
      const dl = await request(a)
        .get(`/api/forms/${FORM}/attachments/${item.id}/download`)
        .set(headers)
        .buffer(true);
      expect(dl.status).toBe(200);
      expect(dl.headers['content-disposition']).toContain('attachment; filename="quote.pdf"');
      expect(dl.headers['x-content-type-options']).toBe('nosniff');
      expect(dl.body.length).toBe(50);

      const view = await request(a).get(`/api/forms/${FORM}/attachments/${item.id}/view`).set(headers);
      expect(view.status).toBe(200);
      expect(view.headers['content-disposition']).toContain('inline');
    }
  });

  it('uploads multiple files with distinct display names and preserves original filenames', async () => {
    const a = app();
    const response = await request(a)
      .post(`/api/forms/${FORM}/attachments`)
      .set(owner)
      .field('category', 'SUPPORTING')
      .field('displayNames', 'Project brief')
      .field('displayNames', 'Pricing backup')
      .attach('files', Buffer.from('%PDF-one'), { filename: 'brief.pdf', contentType: PDF })
      .attach('files', Buffer.from('%PDF-two'), { filename: 'pricing.pdf', contentType: PDF });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.data.map((item: { originalFileName: string }) => item.originalFileName)).toEqual([
      'brief.pdf',
      'pricing.pdf',
    ]);
    expect(response.body.data.map((item: { displayName: string }) => item.displayName)).toEqual([
      'Project brief',
      'Pricing backup',
    ]);
    expect(drive.files.size).toBe(2);
    expect(JSON.stringify(response.body)).not.toContain('drive-');
  });

  it('rejects a display-name count that does not match the files', async () => {
    const a = app();
    const response = await request(a)
      .post(`/api/forms/${FORM}/attachments`)
      .set(owner)
      .field('category', 'SUPPORTING')
      .field('displayNames', 'Only one name')
      .attach('files', Buffer.from('%PDF-one'), { filename: 'brief.pdf', contentType: PDF })
      .attach('files', Buffer.from('%PDF-two'), { filename: 'pricing.pdf', contentType: PDF });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Provide one valid display name for each uploaded file');
    expect(drive.files.size).toBe(0);
  });

  it('renames duplicates instead of overwriting', async () => {
    const a = app();
    await upload(a);
    expect((await upload(a)).body.data[0].fileName).toBe('quote_1.pdf');
    expect(drive.files.size).toBe(2);
  });

  it('requires authentication', async () => {
    expect((await request(app()).get(`/api/forms/${FORM}/attachments`)).status).toBe(401);
  });

  it('denies upload to non-creators before any file is stored', async () => {
    const res = await upload(app(), { headers: { 'x-user': 'other:SUBMITTER' } });
    expect(res.status).toBe(403);
    expect(drive.files.size).toBe(0);
  });

  it('denies viewing to users without access', async () => {
    const a = app();
    const up = await upload(a);
    const headers = { 'x-user': 'outsider:APPROVER' };
    const id = up.body.data[0].id;

    expect((await request(a).get(`/api/forms/${FORM}/attachments`).set(headers)).status).toBe(403);
    expect((await request(a).get(`/api/forms/${FORM}/attachments/${id}/view`).set(headers)).status).toBe(403);
    expect((await request(a).get(`/api/forms/${FORM}/attachments/${id}/download`).set(headers)).status).toBe(403);
  });

  it('does not allow an attachment id to be used under another form', async () => {
    const a = app();
    const up = await upload(a);
    const res = await request(a).get(`/api/forms/${OTHER_FORM}/attachments/${up.body.data[0].id}/download`).set(owner);
    expect(res.status).toBe(403);
  });

  it('returns 404 for an unknown attachment and 400 for a bad id', async () => {
    const a = app();
    const missing = await request(a).get(`/api/forms/${FORM}/attachments/33333333-3333-4333-8333-333333333333/download`).set(owner);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('ATTACHMENT_NOT_FOUND');
    expect((await request(a).get(`/api/forms/not-a-uuid/attachments`).set(owner)).status).toBe(400);
  });

  it('rejects invalid categories (including GENERATED_PDF) and non-Excel cost estimates', async () => {
    const a = app();
    for (const category of ['BAD', 'GENERATED_PDF']) {
      expect((await upload(a, { category })).status).toBe(400);
    }
    const res = await upload(a, { category: 'COST_ESTIMATE_EXCEL' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_CATEGORY_FILE');
    expect(drive.files.size).toBe(0);
  });

  it('returns upload validation errors without storing anything', async () => {
    const a = app();
    expect((await upload(a, { size: 1001 })).status).toBeGreaterThanOrEqual(400);
    expect((await upload(a, { name: 'a.exe' })).status).toBe(400);
    expect((await request(a).post(`/api/forms/${FORM}/attachments`).set(owner).field('category', 'SUPPORTING')).status).toBe(400);
    expect(drive.files.size).toBe(0);
  });

  it('allows only authorized admins and approvers to download the final package', async () => {
    const a = app();
    const submitterDenied = await request(a).post(`/api/forms/${FORM}/final-pdf`).set(owner);
    expect(submitterDenied.status).toBe(403);
    const approverDenied = await request(a)
      .post(`/api/forms/${FORM}/final-pdf`)
      .set({ 'x-user': 'outsider:APPROVER' });
    expect(approverDenied.status).toBe(403);

    for (const headers of [{ 'x-user': 'viewer:APPROVER' }, { 'x-user': 'admin:ADMIN' }]) {
      const response = await request(a)
        .post(`/api/forms/${FORM}/final-pdf`)
        .set(headers)
        .buffer(true)
        .parse((stream, callback) => {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          stream.on('end', () => callback(null, Buffer.concat(chunks)));
        });
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/zip');
      expect(response.headers['content-disposition']).toContain('Contract_CF-1_Full_Package.zip');
      expect(response.body.toString()).toBe('zip-content');
    }

    expect(packageCalls).toEqual([FORM, FORM]);
  });
});
