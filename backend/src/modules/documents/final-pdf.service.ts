import { Readable } from 'node:stream';
import { Zippable, zipSync } from 'fflate';
import { AppError } from '../../utils/app-error';
import { AttachmentRecord } from './attachment.types';
import { DocumentService } from './document.service';
import { DriveError } from './drive.service';
import { buildContractDriveFolderName, sanitizeFilename } from './file.utils';
import { FinalPdfSource, generateFinalContractPdf } from './pdf.service';

export interface FinalPdfActor {
  id: string;
  role: string;
}

export interface FinalPdfServiceDeps {
  documents: DocumentService;
  /** contractService.getContract (checks the actor may see the form). */
  loadForm(formId: string, actor: FinalPdfActor): Promise<FinalPdfSource['form']>;
  /** approvalService.getApprovalHistory. */
  loadHistory(formId: string, actor: FinalPdfActor): Promise<FinalPdfSource['history']>;
  generate?(source: FinalPdfSource): Promise<Buffer>;
  now?(): Date;
}

export interface FinalPdfPackage {
  fileName: string;
  content: Buffer;
}

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Creates the final approved PDF once per form and stores it as a GENERATED_PDF
 * attachment (private Drive file). Safe to call repeatedly: it returns the
 * existing PDF. Call it AFTER the final-approval database transaction has
 * committed; a failure here must not undo the approval.
 */
export function createFinalPdfService(deps: FinalPdfServiceDeps) {
  const inFlight = new Map<string, Promise<AttachmentRecord>>();

  async function run(
    formId: string,
    actor: FinalPdfActor,
    loadedForm?: FinalPdfSource['form']
  ): Promise<AttachmentRecord> {
    const existing = await deps.documents.findByCategory(formId, 'GENERATED_PDF');
    if (existing) return existing;

    const form = loadedForm ?? await deps.loadForm(formId, actor);
    if (form.status !== 'APPROVED') {
      throw new AppError(409, 'FORM_NOT_APPROVED', 'The final PDF can only be generated for approved forms');
    }
    const history = await deps.loadHistory(formId, actor);

    const content = await (deps.generate ?? generateFinalContractPdf)({
      form,
      history,
      generatedAt: (deps.now ?? (() => new Date()))(),
    });

    return deps.documents.storeGeneratedFile({
      contractFormId: formId,
      contractFolderName: buildContractDriveFolderName(form.id, form.title, form.referenceNo),
      category: 'GENERATED_PDF',
      uploadedById: actor.id,
      fileName: sanitizeFilename(
        `${buildContractDriveFolderName(form.id, form.title, form.referenceNo)} - Final.pdf`
      ),
      mimeType: 'application/pdf',
      content,
    });
  }

  async function generatePackage(formId: string, actor: FinalPdfActor): Promise<FinalPdfPackage> {
    const form = await deps.loadForm(formId, actor);
    if (form.status !== 'APPROVED') {
      throw new AppError(409, 'FORM_NOT_APPROVED', 'The final PDF package is only available for approved forms');
    }

    const finalPdf = await generateAndStoreFinalPdf(formId, actor, form);
    const attachments = await deps.documents.list(formId);
    const entries: Zippable = {};

    try {
      const { stream } = await deps.documents.openAttachment(formId, finalPdf.id);
      entries['Contract_Form.pdf'] = await readStream(stream);

      for (const attachment of attachments) {
        if (attachment.category === 'GENERATED_PDF') continue;
        const { stream: attachmentStream } = await deps.documents.openAttachment(formId, attachment.id);
        const fileName = sanitizeFilename(attachment.fileName);
        entries[`Supporting_Documents/${fileName}`] = await readStream(attachmentStream);
      }
    } catch (error) {
      const details =
        error instanceof DriveError
          ? [{ reason: error.message }]
          : error instanceof AppError
            ? [{ reason: error.code }]
            : [];
      throw new AppError(
        502,
        'PACKAGE_FILE_UNAVAILABLE',
        'A contract document could not be retrieved from private storage. No ZIP was created.',
        details
      );
    }

    let content: Buffer;
    try {
      content = Buffer.from(zipSync(entries, { level: 0 }));
    } catch {
      throw new AppError(500, 'PACKAGE_GENERATION_FAILED', 'The contract ZIP could not be generated.');
    }

    const safeReference = (form.referenceNo ?? form.id)
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}._-]+/gu, '_')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 100) || form.id;
    return {
      fileName: `Contract_${safeReference || form.id}_Full_Package.zip`,
      content,
    };
  }

  function generateAndStoreFinalPdf(
    formId: string,
    actor: FinalPdfActor,
    loadedForm?: FinalPdfSource['form']
  ): Promise<AttachmentRecord> {
    // Two simultaneous calls for the same form share one run (in this process).
    const running = inFlight.get(formId);
    if (running) return running;
    const promise = run(formId, actor, loadedForm).finally(() => inFlight.delete(formId));
    inFlight.set(formId, promise);
    return promise;
  }

  return {
    generateAndStoreFinalPdf,
    generatePackage,
  };
}
