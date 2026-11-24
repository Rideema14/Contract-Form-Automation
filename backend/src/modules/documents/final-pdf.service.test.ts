import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import { unzipSync } from 'fflate';
import { AppError } from '../../utils/app-error';
import { InMemoryAttachmentRepository } from './attachment.types';
import { DocumentService } from './document.service';
import { DriveStorage } from './drive.service';
import { createFinalPdfService } from './final-pdf.service';
import { FinalPdfSource } from './pdf.service';

class FakeDrive implements DriveStorage {
  uploads = 0;
  files = new Map<string, Buffer>();
  folderNames: string[] = [];
  async upload({ body, contractFolderName }: Parameters<DriveStorage['upload']>[0]) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const id = `d${++this.uploads}`;
    this.folderNames.push(contractFolderName);
    this.files.set(id, Buffer.concat(chunks));
    return { driveFileId: id };
  }
  async download(id: string) {
    const content = this.files.get(id);
    if (!content) throw new Error('Drive file not found');
    return Readable.from([content]);
  }
  async remove(id: string) { this.files.delete(id); }
}

const form = (status: string) => ({
  id: 'f1',
  referenceNo: 'CF-1',
  title: 'Project X',
  status,
}) as unknown as FinalPdfSource['form'];
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
  return { drive, documents, generate, service };
}

describe('final PDF service', () => {
  it('stores a GENERATED_PDF attachment named with the reference number', async () => {
    const { service, drive } = setup();
    const rec = await service.generateAndStoreFinalPdf('f1', actor);
    expect(rec).toMatchObject({
      category: 'GENERATED_PDF',
      fileName: 'CF-1_-_Final.pdf',
      mimeType: 'application/pdf',
      uploadedById: 'u1',
    });
    expect(drive.uploads).toBe(1);
    expect(drive.folderNames).toEqual(['CF-1']);
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

  it('renders a current PDF snapshot for a draft without storing it', async () => {
    const { service, drive, generate } = setup('DRAFT');

    const file = await service.generateCurrentPdf('f1', actor);

    expect(file.fileName).toBe('CF-1_-_Current.pdf');
    expect(file.content).toEqual(Buffer.from('%PDF-fake'));
    expect(generate).toHaveBeenCalledOnce();
    expect(drive.uploads).toBe(0);
  });

  it('lets a submitter generate the stored final PDF only after approval', async () => {
    const { service, drive } = setup();

    const attachment = await service.generateFinalPdfAttachment('f1', {
      id: 'submitter',
      role: 'SUBMITTER',
    });

    expect(attachment).toMatchObject({
      category: 'GENERATED_PDF',
      uploadedById: 'submitter',
    });
    expect(drive.uploads).toBe(1);
  });

  it('does not generate a final PDF attachment before approval', async () => {
    const { service, drive } = setup('PENDING_APPROVAL');

    await expect(service.generateFinalPdfAttachment('f1', {
      id: 'submitter',
      role: 'SUBMITTER',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'FORM_NOT_APPROVED',
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

  it('retries PDF generation for an approved contract without duplicating the final PDF', async () => {
    const drive = new FakeDrive();
    const documents = new DocumentService({ drive, repository: new InMemoryAttachmentRepository() });
    const generate = vi.fn()
      .mockRejectedValueOnce(new Error('temporary PDF failure'))
      .mockResolvedValueOnce(Buffer.from('%PDF-retried'));
    const service = createFinalPdfService({
      documents,
      generate,
      loadForm: async () => form('APPROVED'),
      loadHistory: async () => history,
    });

    await expect(service.generatePackage('f1', actor)).rejects.toThrow('temporary PDF failure');
    expect(drive.uploads).toBe(0);

    const packageFile = await service.generatePackage('f1', actor);
    expect(Buffer.from(unzipSync(packageFile.content)['Contract_Form.pdf'])).toEqual(Buffer.from('%PDF-retried'));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(drive.uploads).toBe(1);

    const secondPackage = await service.generatePackage('f1', actor);
    expect(Buffer.from(unzipSync(secondPackage.content)['Contract_Form.pdf'])).toEqual(Buffer.from('%PDF-retried'));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(drive.uploads).toBe(1);
  });

  it('creates a ZIP with the complete form PDF and original supporting files', async () => {
    const { drive, documents, generate, service } = setup();
    const supportingPdf = Buffer.from('%PDF-supporting-document');
    const spreadsheet = Buffer.from('saved spreadsheet bytes');
    await documents.storeGeneratedFile({
      contractFormId: 'f1',
      contractFolderName: 'CF-1',
      category: 'SUPPORTING',
      uploadedById: 'u1',
      fileName: 'vendor-quote.pdf',
      mimeType: 'application/pdf',
      content: supportingPdf,
    });
    await documents.storeGeneratedFile({
      contractFormId: 'f1',
      contractFolderName: 'CF-1',
      category: 'COST_ESTIMATE_EXCEL',
      uploadedById: 'u1',
      fileName: 'estimate.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: spreadsheet,
    });

    const result = await service.generatePackage('f1', actor);
    const entries = unzipSync(result.content);

    expect(result.fileName).toBe('Contract_CF-1_Full_Package.zip');
    expect(Object.keys(entries).sort()).toEqual([
      'Contract_Form.pdf',
      'Supporting_Documents/estimate.xlsx',
      'Supporting_Documents/vendor-quote.pdf',
    ]);
    expect(Buffer.from(entries['Contract_Form.pdf'])).toEqual(Buffer.from('%PDF-fake'));
    expect(Buffer.from(entries['Supporting_Documents/vendor-quote.pdf'])).toEqual(supportingPdf);
    expect(Buffer.from(entries['Supporting_Documents/estimate.xlsx'])).toEqual(spreadsheet);
    expect(generate).toHaveBeenCalledOnce();
    expect(drive.uploads).toBe(3);
  });

  it('reuses an existing generated PDF when creating a package', async () => {
    const { drive, documents, generate, service } = setup();
    const savedPdf = Buffer.from('%PDF-existing-final');
    await documents.storeGeneratedFile({
      contractFormId: 'f1',
      contractFolderName: 'CF-1',
      category: 'GENERATED_PDF',
      uploadedById: 'u1',
      fileName: 'CF-1.pdf',
      mimeType: 'application/pdf',
      content: savedPdf,
    });

    const result = await service.generatePackage('f1', actor);
    const entries = unzipSync(result.content);

    expect(Buffer.from(entries['Contract_Form.pdf'])).toEqual(savedPdf);
    expect(generate).not.toHaveBeenCalled();
    expect(drive.uploads).toBe(1);
  });

  it('does not create a package when a stored Drive file is missing', async () => {
    const { drive, documents, service } = setup();
    const generated = await documents.storeGeneratedFile({
      contractFormId: 'f1',
      contractFolderName: 'CF-1',
      category: 'GENERATED_PDF',
      uploadedById: 'u1',
      fileName: 'CF-1.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('%PDF-existing-final'),
    });
    drive.files.delete(generated.driveFileId);

    await expect(service.generatePackage('f1', actor)).rejects.toMatchObject({
      statusCode: 502,
      code: 'PACKAGE_FILE_UNAVAILABLE',
    });
  });

  it('refuses to create a package before approval', async () => {
    const { drive, service } = setup('PENDING_APPROVAL');
    await expect(service.generatePackage('f1', actor)).rejects.toMatchObject({
      statusCode: 409,
      code: 'FORM_NOT_APPROVED',
    });
    expect(drive.uploads).toBe(0);
  });
});
