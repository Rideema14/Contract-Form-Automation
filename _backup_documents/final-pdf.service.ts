import { AppError } from '../../utils/app-error';
import { AttachmentRecord } from './attachment.types';
import { DocumentService } from './document.service';
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

/**
 * Creates the final approved PDF once per form and stores it as a GENERATED_PDF
 * attachment (private Drive file). Safe to call repeatedly: it returns the
 * existing PDF. Call it AFTER the final-approval database transaction has
 * committed; a failure here must not undo the approval.
 */
export function createFinalPdfService(deps: FinalPdfServiceDeps) {
  const inFlight = new Map<string, Promise<AttachmentRecord>>();

  async function run(formId: string, actor: FinalPdfActor): Promise<AttachmentRecord> {
    const existing = await deps.documents.findByCategory(formId, 'GENERATED_PDF');
    if (existing) return existing;

    const form = await deps.loadForm(formId, actor);
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
      category: 'GENERATED_PDF',
      uploadedById: actor.id,
      fileName: `${form.referenceNo ?? form.id}.pdf`,
      mimeType: 'application/pdf',
      content,
    });
  }

  return {
    generateAndStoreFinalPdf(formId: string, actor: FinalPdfActor): Promise<AttachmentRecord> {
      // Two simultaneous calls for the same form share one run (in this process).
      const running = inFlight.get(formId);
      if (running) return running;
      const promise = run(formId, actor).finally(() => inFlight.delete(formId));
      inFlight.set(formId, promise);
      return promise;
    },
  };
}
