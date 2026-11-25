import { prisma } from '../../lib/prisma';
import { recordAuditEvent } from '../../services/audit.service';
import { AttachmentRecord, AttachmentRepository, NewAttachment } from './attachment.types';

/** Prisma implementation of the attachment repository (Attachment model already exists in the schema). */
export class PrismaAttachmentRepository implements AttachmentRepository {
  create(data: NewAttachment): Promise<AttachmentRecord> {
    return prisma.attachment.create({ data });
  }
  findById(id: string): Promise<AttachmentRecord | null> {
    return prisma.attachment.findUnique({ where: { id } });
  }
  listByContract(contractFormId: string): Promise<AttachmentRecord[]> {
    return prisma.attachment.findMany({ where: { contractFormId }, orderBy: { createdAt: 'asc' } });
  }
  async delete(id: string): Promise<boolean> {
    const result = await prisma.attachment.deleteMany({ where: { id } });
    return result.count > 0;
  }
  async restore(record: AttachmentRecord): Promise<void> {
    await prisma.attachment.create({ data: record });
  }

  async recordAuditEvents(records: AttachmentRecord[]): Promise<void> {
    if (records.length === 0) return;

    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        await recordAuditEvent(tx, {
          actorId: record.uploadedById,
          action: record.category === 'GENERATED_PDF' ? 'PDF_GENERATED' : 'ATTACHMENT_UPLOADED',
          entityType: 'Attachment',
          entityId: record.id,
          contractFormId: record.contractFormId,
          details: {
            category: record.category,
            fileName: record.fileName,
            mimeType: record.mimeType,
            sizeBytes: record.sizeBytes,
          },
        });
      }
    });
  }
}
