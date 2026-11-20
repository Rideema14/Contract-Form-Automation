import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { AppError } from '../../utils/app-error';
import {
  AttachmentCategory,
  AttachmentRecord,
  AttachmentRepository,
  UserUploadCategory,
} from './attachment.types';
import { DriveStorage } from './drive.service';
import { getExtension } from './file.validator';
import { resolveDuplicateFilename, sanitizeFilename } from './file.utils';

/** The subset of a Multer file this service needs. */
export interface UploadedFile {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface DocumentServiceDeps {
  drive: DriveStorage;
  repository: AttachmentRepository;
}

const EXCEL_EXTENSIONS = ['xls', 'xlsx'];

function reportCleanupFailure(
  operation: string,
  originalError: unknown,
  cleanupErrors: unknown[],
  driveFileIds: string[]
): AppError {
  console.error('Private document cleanup failed', {
    operation,
    originalError,
    cleanupErrors,
    driveFileIds,
  });
  return new AppError(
    500,
    'DOCUMENT_CLEANUP_FAILED',
    'The document operation failed and storage cleanup was incomplete. Contact an administrator.'
  );
}

export class DocumentService {
  constructor(private readonly deps: DocumentServiceDeps) {}

  /**
   * Stores already-validated files in Drive and records their metadata.
   * If anything fails part-way, everything stored by THIS call is removed.
   */
  async uploadAttachments(input: {
    contractFormId: string;
    category: UserUploadCategory;
    uploadedById: string;
    files: UploadedFile[];
  }): Promise<AttachmentRecord[]> {
    const { drive, repository } = this.deps;

    // COST_ESTIMATE_EXCEL must really be a spreadsheet (checked before anything is stored).
    if (input.category === 'COST_ESTIMATE_EXCEL') {
      const bad = input.files.find((f) => !EXCEL_EXTENSIONS.includes(getExtension(f.originalname)));
      if (bad) {
        throw new AppError(
          400,
          'INVALID_CATEGORY_FILE',
          'Cost estimate files must be Excel spreadsheets (.xls or .xlsx)',
          [{ fileName: bad.originalname }]
        );
      }
    }

    const existing = (await repository.listByContract(input.contractFormId)).map((r) => r.fileName);
    const created: AttachmentRecord[] = [];
    const driveFileIds: string[] = [];

    try {
      for (const file of input.files) {
        const fileName = resolveDuplicateFilename(sanitizeFilename(file.originalname), existing);
        existing.push(fileName);

        const { driveFileId } = await drive.upload({
          name: fileName,
          mimeType: file.mimetype,
          body: createReadStream(file.path),
          contractFormId: input.contractFormId,
        });
        driveFileIds.push(driveFileId);
        created.push(
          await repository.create({
            contractFormId: input.contractFormId,
            category: input.category,
            fileName,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            driveFileId,
            uploadedById: input.uploadedById,
          })
        );
      }
      return created;
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      for (const driveFileId of driveFileIds) {
        try {
          await drive.remove(driveFileId);
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      for (const record of created) {
        try {
          await repository.delete(record.id);
        } catch (cleanupError) {
          cleanupErrors.push(cleanupError);
        }
      }
      if (cleanupErrors.length > 0) {
        throw reportCleanupFailure('upload rollback', error, cleanupErrors, driveFileIds);
      }
      throw error;
    }
  }

  list(contractFormId: string): Promise<AttachmentRecord[]> {
    return this.deps.repository.listByContract(contractFormId);
  }

  async deleteFilesForContract(contractFormId: string): Promise<void> {
    const records = await this.deps.repository.listByContract(contractFormId);
    const failures: unknown[] = [];

    for (const record of records) {
      try {
        await this.deps.drive.remove(record.driveFileId);
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      console.error('Contract attachment deletion failed', {
        contractFormId,
        driveFileIds: records.map((record) => record.driveFileId),
        failures,
      });
      throw new AppError(
        502,
        'DRIVE_DELETE_FAILED',
        'Some contract files could not be removed. The contract records were preserved; an administrator can retry.'
      );
    }
  }

  async findByCategory(
    contractFormId: string,
    category: AttachmentCategory
  ): Promise<AttachmentRecord | null> {
    const all = await this.deps.repository.listByContract(contractFormId);
    return all.find((r) => r.category === category) ?? null;
  }

  /** Looks the file up INSIDE the given contract, so IDs cannot be used across contracts. */
  async openAttachment(
    contractFormId: string,
    attachmentId: string
  ): Promise<{ record: AttachmentRecord; stream: Readable }> {
    const record = await this.deps.repository.findById(attachmentId);
    if (!record || record.contractFormId !== contractFormId) {
      throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found');
    }
    return { record, stream: await this.deps.drive.download(record.driveFileId) };
  }

  /** System use (final PDF): stores a buffer as an attachment. */
  async storeGeneratedFile(input: {
    contractFormId: string;
    category: AttachmentCategory;
    uploadedById: string;
    fileName: string;
    mimeType: string;
    content: Buffer;
  }): Promise<AttachmentRecord> {
    const { drive, repository } = this.deps;
    const existing = (await repository.listByContract(input.contractFormId)).map((r) => r.fileName);
    const fileName = resolveDuplicateFilename(sanitizeFilename(input.fileName), existing);
    const { driveFileId } = await drive.upload({
      name: fileName,
      mimeType: input.mimeType,
      body: Readable.from(input.content),
      contractFormId: input.contractFormId,
    });
    try {
      return await repository.create({
        contractFormId: input.contractFormId,
        category: input.category,
        fileName,
        mimeType: input.mimeType,
        sizeBytes: input.content.length,
        driveFileId,
        uploadedById: input.uploadedById,
      });
    } catch (error) {
      try {
        await drive.remove(driveFileId);
      } catch (cleanupError) {
        throw reportCleanupFailure('generated file rollback', error, [cleanupError], [driveFileId]);
      }
      throw error;
    }
  }
}
