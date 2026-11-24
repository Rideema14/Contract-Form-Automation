import { prisma } from '../../lib/prisma';
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
}
