import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import * as contractService from '../services/contract.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/response';

const attachmentParamsSchema = z.object({
  formId: z.string().uuid(),
}).strict();

function getFormId(req: Request): string {
  const parsed = attachmentParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Invalid contract form ID',
      parsed.error.issues,
    );
  }

  return parsed.data.formId;
}

function getUser(req: Request) {
  if (!req.authUser) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }

  return req.authUser;
}

/**
 * Check contract ownership and editable status BEFORE accepting file bytes.
 */
export function authorizeAttachmentUpload(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const formId = getFormId(req);
    const user = getUser(req);

    contractService.assertCanUploadAttachments(formId, user)
      .then(() => next())
      .catch(next);
  } catch (error) {
    next(error);
  }
}

/**
 * Phase 1 validation endpoint.
 * Files are temporary and are cleaned up when the response closes.
 * Permanent storage and Attachment records are handled in the Drive phase.
 */
export function validateAttachments(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const formId = getFormId(req);
    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      throw new AppError(400, 'NO_FILES_UPLOADED', 'Select at least one file');
    }

    sendSuccess(
      req,
      res,
      200,
      'Files passed upload validation. They have not been permanently stored.',
      {
        contractFormId: formId,
        persisted: false,
        files: files.map((file) => ({
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        })),
      },
    );
  } catch (error) {
    next(error);
  }
}
