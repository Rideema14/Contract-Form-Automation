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
  generateFinalPdfPackage,
} from '../modules/documents/documents.runtime';
import { buildContractDriveFolderName } from '../modules/documents/file.utils';
import * as contractService from '../services/contract.service';
import {
  authorizeAttachmentUpload,
  validateAttachments,
} from '../controllers/attachments.controller';

const router = Router();

router.get(
  '/:formId/attachments/config',
  authenticate,
  async (req, res, next) => {
    try {
      const formId = Array.isArray(req.params.formId) ? req.params.formId[0] : req.params.formId;
      if (!req.authUser) {
        throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
      }
      await contractService.assertCanViewAttachments(formId, req.authUser as never);
      const config = loadDocumentUploadConfig();
      res.status(200).json({
        success: true,
        message: 'Attachment upload configuration retrieved',
        data: {
          allowedExtensions: config.allowedExtensions,
          maxFileSizeBytes: config.maxFileSizeBytes,
          maxFileCount: config.maxFileCount,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

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
    getContractFolderName: async (formId, user) => {
      const form = await contractService.getContract(formId, user as never);
      return buildContractDriveFolderName(form.id, form.title, form.referenceNo);
    },
    upload: configuredDocumentUpload,
    generatePackage: (formId, user) => generateFinalPdfPackage(formId, user),
  }),
);

// Upload errors use the same response envelope as the rest of the API.
router.use(documentUploadErrorHandler);

export default router;
