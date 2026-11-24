import { randomUUID } from 'node:crypto';

/** Matches the AttachmentCategory enum in prisma/schema.prisma. */
export const ATTACHMENT_CATEGORIES = ['SUPPORTING', 'COST_ESTIMATE_EXCEL', 'GENERATED_PDF'] as const;
export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

/** Categories a user may upload. GENERATED_PDF is created only by the system. */
export const USER_UPLOAD_CATEGORIES = ['SUPPORTING', 'COST_ESTIMATE_EXCEL'] as const;
export type UserUploadCategory = (typeof USER_UPLOAD_CATEGORIES)[number];

/** Matches the Attachment model in prisma/schema.prisma. */
export interface AttachmentRecord {
  id: string;
  contractFormId: string;
  category: AttachmentCategory;
  /** Sanitised, de-duplicated filename used for storage and downloads. */
  fileName: string;
  originalFileName: string | null;
  displayName: string | null;
  mimeType: string;
  sizeBytes: number;
  /** Private Drive id. Never returned to clients. */
  driveFileId: string;
  uploadedById: string;
  createdAt: Date;
}

export type NewAttachment = Omit<AttachmentRecord, 'id' | 'createdAt'>;

export interface AttachmentRepository {
  create(data: NewAttachment): Promise<AttachmentRecord>;
  findById(id: string): Promise<AttachmentRecord | null>;
  listByContract(contractFormId: string): Promise<AttachmentRecord[]>;
  delete(id: string): Promise<void>;
  recordAuditEvents(records: AttachmentRecord[]): Promise<void>;
}

/** In-memory repository for tests and local development. */
export class InMemoryAttachmentRepository implements AttachmentRepository {
  private readonly rows = new Map<string, AttachmentRecord>();
  private readonly auditEvents: Array<{ action: string; attachmentId: string }> = [];

  async create(data: NewAttachment): Promise<AttachmentRecord> {
    const record: AttachmentRecord = { ...data, id: randomUUID(), createdAt: new Date() };
    this.rows.set(record.id, record);
    return record;
  }
  async findById(id: string): Promise<AttachmentRecord | null> {
    return this.rows.get(id) ?? null;
  }
  async listByContract(contractFormId: string): Promise<AttachmentRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.contractFormId === contractFormId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async recordAuditEvents(records: AttachmentRecord[]): Promise<void> {
    this.auditEvents.push(...records.map((record) => ({
      action: record.category === 'GENERATED_PDF' ? 'PDF_GENERATED' : 'ATTACHMENT_UPLOADED',
      attachmentId: record.id,
    })));
  }

  listAuditEvents(): Array<{ action: string; attachmentId: string }> {
    return [...this.auditEvents];
  }
}
