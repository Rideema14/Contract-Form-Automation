import { Router, RequestHandler } from 'express';

import authenticate from '../middleware/authenticate';
import {
  createDocumentUploadMiddleware,
  documentUploadErrorHandler,
} from '../modules/documents/upload.middleware';
import {
  DocumentConfigError,
  loadDocumentUploadConfig,
} from '../modules/documents/document.config';
import { AppError } from '../utils/app-error';
import { createAttachmentsRouter } from '../modules/documents/attachments.router';
import {
  assertCanViewAttachments,
  documentService,
  generateAndStoreFinalPdf,
} from '../modules/documents/documents.runtime';
import * as contractService from '../services/contract.service';
import {
  authorizeAttachmentUpload,
  validateAttachments,
} from '../controllers/attachments.controller';

const router = Router();

/**
 * Load production upload policy from environment variables.
 * Missing configuration fails closed; it does not silently use test limits.
 */
const configuredDocumentUpload: RequestHandler = (req, res, next) => {
  try {
    const config = loadDocumentUploadConfig();
    createDocumentUploadMiddleware(config, 'files')(req, res, next);
  } catch (error) {
    if (error instanceof DocumentConfigError) {
      next(new AppError(
        503,
        'DOCUMENT_UPLOAD_NOT_CONFIGURED',
        'Document upload is not configured on this server',
        error.missing.map((key) => ({ key })),
      ));
      return;
    }

    next(error);
  }
};

router.post(
  '/:formId/attachments/validate',
  authenticate,
  authorizeAttachmentUpload,
  configuredDocumentUpload,
  validateAttachments,
);

router.use(
  createAttachmentsRouter({
    service: documentService,
    authenticate,
    assertCanUpload: (formId, user) => contractService.assertCanUploadAttachments(formId, user as never),
    assertCanView: assertCanViewAttachments,
    upload: configuredDocumentUpload,
    ensureFinalPdf: (formId, user) => generateAndStoreFinalPdf(formId, user),
  }),
);

// Upload errors use the same response envelope as the rest of the API.
router.use(documentUploadErrorHandler);

export default router;
