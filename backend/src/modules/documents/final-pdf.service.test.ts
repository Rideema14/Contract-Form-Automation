import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { AppError } from '../../utils/app-error';
import { InMemoryAttachmentRepository } from './attachment.types';
import { DocumentService } from './document.service';
import { DriveStorage } from './drive.service';
import { createFinalPdfService } from './final-pdf.service';
import { FinalPdfSource } from './pdf.service';

class FakeDrive implements DriveStorage {
  uploads = 0;
  async upload() { this.uploads++; return { driveFileId: `d${this.uploads}` }; }
  async download() { return Readable.from(['x']); }
  async remove() {}
}

const form = (status: string) => ({ id: 'f1', referenceNo: 'CF-1', status }) as unknown as FinalPdfSource['form'];
const history = { approvalSteps: [], decisions: [] } as FinalPdfSource['history'];
const actor = { id: 'u1', role: 'APPROVER' };

function setup(status = 'APPROVED') {
  const drive = new FakeDrive();
  const documents = new DocumentService({ drive, repository: new InMemoryAttachmentRepository() });
  const generate = vi.fn().mockResolvedValue(Buffer.from('%PDF-fake'));
  const service = createFinalPdfService({
    documents, generate,
    loadForm: async () => form(status),
    loadHistory: async () => history,
  });
  return { drive, generate, service };
}

describe('final PDF service', () => {
  it('stores a GENERATED_PDF attachment named after the reference number', async () => {
    const { service, drive } = setup();
    const rec = await service.generateAndStoreFinalPdf('f1', actor);
    expect(rec).toMatchObject({ category: 'GENERATED_PDF', fileName: 'CF-1.pdf', mimeType: 'application/pdf', uploadedById: 'u1' });
    expect(drive.uploads).toBe(1);
  });

  it('is idempotent: a second call returns the existing PDF', async () => {
    const { service, drive, generate } = setup();
    const first = await service.generateAndStoreFinalPdf('f1', actor);
    const second = await service.generateAndStoreFinalPdf('f1', actor);
    expect(second.id).toBe(first.id);
    expect(drive.uploads).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('shares one run between simultaneous calls', async () => {
    const { service, drive } = setup();
    const [a, b] = await Promise.all([
      service.generateAndStoreFinalPdf('f1', actor),
      service.generateAndStoreFinalPdf('f1', actor),
    ]);
    expect(a.id).toBe(b.id);
    expect(drive.uploads).toBe(1);
  });

  it('refuses forms that are not approved and uploads nothing', async () => {
    const { service, drive } = setup('PENDING_APPROVAL');
    await expect(service.generateAndStoreFinalPdf('f1', actor)).rejects.toMatchObject({
      statusCode: 409, code: 'FORM_NOT_APPROVED',
    });
    expect(drive.uploads).toBe(0);
  });

  it('propagates generation errors', async () => {
    const drive = new FakeDrive();
    const service = createFinalPdfService({
      documents: new DocumentService({ drive, repository: new InMemoryAttachmentRepository() }),
      generate: async () => { throw new Error('pdf failed'); },
      loadForm: async () => form('APPROVED'),
      loadHistory: async () => history,
    });
    await expect(service.generateAndStoreFinalPdf('f1', actor)).rejects.toThrow('pdf failed');
    expect(AppError).toBeDefined();
  });
});
