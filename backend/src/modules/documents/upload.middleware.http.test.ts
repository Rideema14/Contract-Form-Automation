import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseDocumentUploadConfig } from './document.config';
import {
  createDocumentUploadMiddleware,
  documentUploadErrorHandler,
} from './upload.middleware';

/**
 * End-to-end tests: real multipart requests go through Multer, the validator
 * and the cleanup logic. The middleware is mounted on a throwaway Express app,
 * never on the shared application.
 */

const PDF = 'application/pdf';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Test-only values. Real limits are still undecided (CL-14).
const config = parseDocumentUploadConfig({
  allowedExtensions: ['pdf', 'xlsx'],
  maxFileSizeBytes: 1024,
  maxFileCount: 2,
});

const tempDirectory = path.join(os.tmpdir(), 'contract-forms-automation', 'document-uploads');

let before: Set<string>;
let handlerSaw: { path: string; originalname: string; existed: boolean }[];

const listTemp = async () => new Set(await fs.readdir(tempDirectory).catch(() => [] as string[]));

/** Files created by the current test and still on disk. Polls because cleanup after a response is asynchronous. */
async function leftovers(settle = true): Promise<string[]> {
  for (let i = 0; i < (settle ? 50 : 1); i++) {
    const now = await listTemp();
    const extra = [...now].filter((name) => !before.has(name));
    if (extra.length === 0) return [];
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return [...(await listTemp())].filter((name) => !before.has(name));
}

function buildApp(fieldName = 'files') {
  const app = express();
  app.post('/upload', createDocumentUploadMiddleware(config, fieldName), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    handlerSaw = await Promise.all(
      files.map(async (f) => ({
        path: f.path,
        originalname: f.originalname,
        existed: await fs.stat(f.path).then(() => true, () => false),
      }))
    );
    res.status(201).json({ success: true, count: files.length });
  });
  app.use(documentUploadErrorHandler);
  return app;
}

const bytes = (n: number) => Buffer.alloc(n, 'a');

/** Sends a multipart body by hand, so the filename reaches the server exactly as written (no client-side stripping). */
function rawUpload(filename: string, content: Buffer = bytes(10), contentType = PDF) {
  const boundary = '----rawboundary';
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="files"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return request(buildApp())
    .post('/upload')
    .set('Content-Type', `multipart/form-data; boundary=${boundary}`)
    .send(body);
}

beforeEach(async () => {
  handlerSaw = [];
  before = await listTemp();
});

describe('createDocumentUploadMiddleware: accepted uploads', () => {
  it('accepts a valid PDF and stores it under a random server-side name', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(100), { filename: 'Quotation 1.pdf', contentType: PDF });

    expect(res.status).toBe(201);
    expect(handlerSaw[0].existed).toBe(true);
    expect(handlerSaw[0].originalname).toBe('Quotation 1.pdf');
    expect(path.basename(handlerSaw[0].path)).toMatch(/^[0-9a-f-]{36}\.pdf$/);
  });

  it('accepts several valid files up to the maximum count', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(10), { filename: 'a.pdf', contentType: PDF })
      .attach('files', bytes(10), { filename: 'b.xlsx', contentType: XLSX });

    expect(res.status).toBe(201);
    expect(res.body.count).toBe(2);
  });

  it('accepts a file exactly at the size limit', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(1024), { filename: 'edge.pdf', contentType: PDF });
    expect(res.status).toBe(201);
  });

  it('stores duplicate filenames separately without overwriting', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(10), { filename: 'same.pdf', contentType: PDF })
      .attach('files', bytes(20), { filename: 'same.pdf', contentType: PDF });

    expect(res.status).toBe(201);
    expect(handlerSaw).toHaveLength(2);
    expect(handlerSaw[0].path).not.toBe(handlerSaw[1].path);
    expect(handlerSaw.every((f) => f.existed)).toBe(true);
  });

  it('keeps a Unicode filename intact as metadata', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(10), { filename: 'résumé-契約.pdf', contentType: PDF });

    expect(res.status).toBe(201);
    expect(handlerSaw[0].originalname).toBe('résumé-契約.pdf');
  });

  it('accepts a MIME type that carries parameters', async () => {
    const res = await rawUpload('a.pdf', bytes(10), 'application/pdf; charset=binary');
    expect(res.status).toBe(201);
  });
});

describe('createDocumentUploadMiddleware: rejected uploads', () => {
  it('rejects a disallowed extension', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(10), { filename: 'virus.exe', contentType: 'application/octet-stream' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { code: 'DOCUMENT_VALIDATION_FAILED' } });
    expect(res.body.error.details[0].code).toBe('EXTENSION_NOT_ALLOWED');
    expect(await leftovers()).toEqual([]);
  });

  it('rejects a file without an extension', async () => {
    const res = await rawUpload('noextension');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('MISSING_EXTENSION');
  });

  it('rejects a MIME type that does not match the extension', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(10), { filename: 'sheet.xlsx', contentType: PDF });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('MIME_EXTENSION_MISMATCH');
    expect(await leftovers()).toEqual([]);
  });

  it('rejects a MIME type that is not allowed at all', async () => {
    const res = await rawUpload('a.pdf', bytes(10), 'application/zip');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('MIME_NOT_ALLOWED');
  });

  it('rejects a file over the size limit and leaves no partial file', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(1025), { filename: 'big.pdf', contentType: PDF });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('LIMIT_FILE_SIZE');
    expect(await leftovers()).toEqual([]);
  });

  it('rejects more files than allowed and removes the files already written', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(10), { filename: 'a.pdf', contentType: PDF })
      .attach('files', bytes(10), { filename: 'b.pdf', contentType: PDF })
      .attach('files', bytes(10), { filename: 'c.pdf', contentType: PDF });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LIMIT_FILE_COUNT');
    expect(await leftovers()).toEqual([]);
  });

  it('rejects an empty (zero-byte) file and removes it', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', Buffer.alloc(0), { filename: 'empty.pdf', contentType: PDF });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('EMPTY_FILE');
    expect(await leftovers()).toEqual([]);
  });

  it('rejects a request with no files', async () => {
    const res = await request(buildApp()).post('/upload').field('note', 'hello');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('NO_FILES');
  });

  it('rejects a non-multipart request', async () => {
    const res = await request(buildApp()).post('/upload').send({ a: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('NO_FILES');
  });

  it('treats an empty filename as no file and stores nothing', async () => {
    const res = await rawUpload('');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].code).toBe('NO_FILES');
    expect(await leftovers()).toEqual([]);
  });

  it.each([
    ['../../etc/passwd.pdf'],
    ['..\\..\\windows\\system32\\evil.pdf'],
    ['%2e%2e%2fsecret.pdf'],
  ])('rejects the path traversal filename %s', async (filename) => {
    const res = await rawUpload(filename);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((i: { code: string }) => i.code)).toContain('PATH_TRAVERSAL');
    expect(await leftovers()).toEqual([]);
  });

  it.each([['invoice.exe.pdf'], ['CON.pdf'], ['report.pdf.']])(
    'rejects the unsafe filename %s',
    async (filename) => {
      const res = await rawUpload(filename);
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].code).toBe('DANGEROUS_FILENAME');
    }
  );

  it('rejects a file sent in the wrong field', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('attachment', bytes(10), { filename: 'a.pdf', contentType: PDF });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LIMIT_UNEXPECTED_FILE');
    expect(await leftovers()).toEqual([]);
  });

  it('rejects the whole request, and cleans up, when one of two files is invalid', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(10), { filename: 'good.pdf', contentType: PDF })
      .attach('files', bytes(10), { filename: 'bad.exe', contentType: 'application/octet-stream' });

    expect(res.status).toBe(400);
    expect(await leftovers()).toEqual([]);
  });
});

describe('createDocumentUploadMiddleware: temporary file cleanup and setup', () => {
  it('deletes the temporary files once the response has been sent', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .attach('files', bytes(10), { filename: 'a.pdf', contentType: PDF });

    expect(res.status).toBe(201);
    expect(handlerSaw[0].existed).toBe(true);
    expect(await leftovers()).toEqual([]);
  });

  it('requires a field name', () => {
    expect(() => createDocumentUploadMiddleware(config, '  ')).toThrow(TypeError);
  });

  it('passes errors that are not upload errors to the next handler', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new Error('unrelated');
    });
    app.use(documentUploadErrorHandler);
    app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ handledBy: 'next-handler' });
    });

    const res = await request(app).get('/boom');
    expect(res.body.handledBy).toBe('next-handler');
  });
});