import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { InMemoryAttachmentRepository, AttachmentRepository } from './attachment.types';
import { DriveStorage } from './drive.service';
import { AppError } from '../../utils/app-error';
import { DocumentService } from './document.service';

class FakeDrive implements DriveStorage {
  files = new Map<string, string>();
  failOnUploadNumber = 0;
  private n = 0;
  async upload() {
    this.n++;
    if (this.n === this.failOnUploadNumber) throw new Error('drive down');
    const id = `d${this.n}`;
    this.files.set(id, 'x');
    return { driveFileId: id };
  }
  async download() {
    return Readable.from(['x']);
  }
  async remove(id: string) {
    this.files.delete(id);
  }
}

let dir: string | undefined;
afterEach(async () => {
  if (dir) await fs.rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function tempFile(name: string) {
  dir ??= await fs.mkdtemp(path.join(os.tmpdir(), 'docsvc-'));
  const p = path.join(dir, name);
  await fs.writeFile(p, 'content');
  return { path: p, originalname: name, mimetype: 'application/pdf', size: 7 };
}
const base = { contractFormId: 'c1', category: 'SUPPORTING' as const, uploadedById: 'u1' };

describe('DocumentService', () => {
  it('sanitises names and resolves duplicates, including within one batch', async () => {
    const repo = new InMemoryAttachmentRepository();
    const svc = new DocumentService({ drive: new FakeDrive(), repository: repo });
    const a = await tempFile('my quote.pdf');
    const records = await svc.uploadAttachments({ ...base, files: [a, a] });
    expect(records.map((r) => r.fileName)).toEqual(['my_quote.pdf', 'my_quote_1.pdf']);
      });

  it('rolls back Drive files and records when a later upload fails', async () => {
    const drive = new FakeDrive();
    drive.failOnUploadNumber = 2;
    const repo = new InMemoryAttachmentRepository();
    const svc = new DocumentService({ drive, repository: repo });
    const f = await tempFile('a.pdf');
    await expect(svc.uploadAttachments({ ...base, files: [f, f] })).rejects.toThrow('drive down');
    expect(drive.files.size).toBe(0);
    expect(await repo.listByContract('c1')).toEqual([]);
  });

  it('removes the Drive file if saving metadata fails', async () => {
    const drive = new FakeDrive();
    const repo: AttachmentRepository = {
      ...new InMemoryAttachmentRepository(),
      listByContract: async () => [],
      create: async () => {
        throw new Error('db down');
      },
      findById: async () => null,
      delete: async () => undefined,
    };
    const svc = new DocumentService({ drive, repository: repo });
    await expect(svc.uploadAttachments({ ...base, files: [await tempFile('a.pdf')] })).rejects.toThrow('db down');
    expect(drive.files.size).toBe(0);
  });

  it('opens only attachments that belong to the contract', async () => {
    const repo = new InMemoryAttachmentRepository();
    const svc = new DocumentService({ drive: new FakeDrive(), repository: repo });
    const [rec] = await svc.uploadAttachments({ ...base, files: [await tempFile('a.pdf')] });
    await expect(svc.openAttachment('other', rec.id)).rejects.toBeInstanceOf(AppError);
    expect((await svc.openAttachment('c1', rec.id)).record.id).toBe(rec.id);
  });

  it('rejects non-Excel files in the COST_ESTIMATE_EXCEL category before storing anything', async () => {
    const drive = new FakeDrive();
    const svc = new DocumentService({ drive, repository: new InMemoryAttachmentRepository() });
    await expect(
      svc.uploadAttachments({ ...base, category: 'COST_ESTIMATE_EXCEL', files: [await tempFile('a.pdf')] })
    ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CATEGORY_FILE' });
    expect(drive.files.size).toBe(0);
    const ok = await svc.uploadAttachments({ ...base, category: 'COST_ESTIMATE_EXCEL', files: [await tempFile('cost.xlsx')] });
    expect(ok[0].category).toBe('COST_ESTIMATE_EXCEL');
  });

  it('stores generated files such as the final PDF', async () => {
    const repo = new InMemoryAttachmentRepository();
    const svc = new DocumentService({ drive: new FakeDrive(), repository: repo });
    const rec = await svc.storeGeneratedFile({
      contractFormId: 'c1', category: 'GENERATED_PDF', uploadedById: 'system',
      fileName: 'Final Contract.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF-x'),
    });
    expect(rec.fileName).toBe('Final_Contract.pdf');
    expect(rec.sizeBytes).toBe(6);
  });
});
