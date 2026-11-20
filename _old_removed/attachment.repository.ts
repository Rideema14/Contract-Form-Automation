import { prisma } from '../../lib/prisma';
import type { AttachmentRepository, AttachmentRecord } from './attachment.types';

export const prismaAttachmentRepository: AttachmentRepository = {
  async create(data) { return prisma.attachment.create({ data }) as Promise<AttachmentRecord>; },
  async findMany(contractFormId) { return prisma.attachment.findMany({ where: { contractFormId }, orderBy: { createdAt: 'desc' } }) as Promise<AttachmentRecord[]>; },
  async findById(id) { return prisma.attachment.findUnique({ where: { id } }) as Promise<AttachmentRecord | null>; },
  async findNames(contractFormId) { const rows = await prisma.attachment.findMany({ where: { contractFormId }, select: { fileName: true } }); return rows.map(x => x.fileName); },
  async delete(id) { await prisma.attachment.delete({ where: { id } }); },
};
