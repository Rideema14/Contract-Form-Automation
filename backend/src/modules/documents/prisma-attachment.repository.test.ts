import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../lib/prisma';
import { AttachmentRecord } from './attachment.types';
import { PrismaAttachmentRepository } from './prisma-attachment.repository';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PrismaAttachmentRepository audit events', () => {
  it('records attachment uploads and generated PDFs in one transaction', async () => {
    const auditCreate = vi.fn().mockResolvedValue({});
    const tx = { auditLog: { create: auditCreate } };
    vi.spyOn(prisma, '$transaction').mockImplementation(
      async (callback) => callback(tx as never) as never,
    );
    const repository = new PrismaAttachmentRepository();
    const base = {
      contractFormId: 'form-1',
      fileName: 'contract.pdf',
      originalFileName: 'contract.pdf',
      displayName: 'Contract',
      mimeType: 'application/pdf',
      sizeBytes: 120,
      driveFileId: 'private-drive-id',
      uploadedById: 'user-1',
      createdAt: new Date('2026-11-24T00:00:00Z'),
    };
    const records: AttachmentRecord[] = [
      { ...base, id: 'attachment-1', category: 'SUPPORTING' },
      { ...base, id: 'attachment-2', category: 'GENERATED_PDF' },
    ];

    await repository.recordAuditEvents(records);

    expect(auditCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        actorId: 'user-1',
        action: 'ATTACHMENT_UPLOADED',
        entityType: 'Attachment',
        entityId: 'attachment-1',
        contractFormId: 'form-1',
        details: {
          category: 'SUPPORTING',
          fileName: 'contract.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 120,
        },
      }),
    });
    expect(auditCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        actorId: 'user-1',
        action: 'PDF_GENERATED',
        entityType: 'Attachment',
        entityId: 'attachment-2',
        contractFormId: 'form-1',
      }),
    });
  });
});
