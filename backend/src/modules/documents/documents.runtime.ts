import { Readable } from 'node:stream';
import * as approvalService from '../../services/approval.service';
import * as contractService from '../../services/contract.service';
import { AppError } from '../../utils/app-error';
import { createFinalPdfService, FinalPdfActor } from './final-pdf.service';
import { DocumentService } from './document.service';
import { createGoogleDriveStorage, DriveError, DriveStorage } from './drive.service';
import { PrismaAttachmentRepository } from './prisma-attachment.repository';

/** Creates the Drive client on first use, so the server still starts without Google credentials. */
function lazyDrive(): DriveStorage {
  let drive: DriveStorage | undefined;
  const get = (): DriveStorage => {
    try {
      drive ??= createGoogleDriveStorage();
      return drive;
    } catch (error) {
      throw new AppError(503, 'DRIVE_NOT_CONFIGURED', 'Document storage is not configured on this server', [
        { reason: error instanceof DriveError ? error.message : 'unknown' },
      ]);
    }
  };
  return {
    upload: (input) => get().upload(input),
    download: (id): Promise<Readable> => get().download(id),
    remove: (id) => get().remove(id),
  };
}

export const documentService = new DocumentService({
  drive: lazyDrive(),
  repository: new PrismaAttachmentRepository(),
});

/** One permission rule for viewing attachments: Member 1's contract.service (admin, creator or assigned approver). */
export const assertCanViewAttachments = (formId: string, user: FinalPdfActor) =>
  contractService.assertCanViewAttachments(formId, user as never);

const finalPdfService = createFinalPdfService({
  documents: documentService,
  loadForm: (formId, actor) => contractService.getContract(formId, actor as never) as never,
  loadHistory: (formId, actor) => approvalService.getApprovalHistory(formId, actor as never) as never,
});

/** For Member 2: call after the final approval has been committed. Idempotent. */
export function generateAndStoreFinalPdf(formId: string, actor: FinalPdfActor) {
  return finalPdfService.generateAndStoreFinalPdf(formId, actor);
}
