
import { Router, type Request, type RequestHandler } from 'express';
import type { Multer } from 'multer';
import type { UserRole } from '@prisma/client';
import { USER_UPLOAD_CATEGORIES } from './attachment.types';

const AttachmentCategory = {
  CONTRACT: 'CONTRACT',
  AMENDMENT: 'AMENDMENT',
  SUPPORTING: 'SUPPORTING',
  OTHER: 'OTHER',
  GENERATED_PDF: 'GENERATED_PDF'
} as const;

type AttachmentCategory = typeof AttachmentCategory[keyof typeof AttachmentCategory];
import type { DocumentService } from './document.service';
import { AppError } from '../../utils/app-error';
import { getDocumentUploadError, cleanupTemporaryUploads } from './upload.middleware';

export interface DocumentAccessPolicy {
  canView(user: { id: string; role: UserRole }, contractId: string): Promise<boolean>;
  canUpload(user: { id: string; role: UserRole }, contractId: string): Promise<boolean>;
}

// Safely extracts route parameters in Express 5.
function getRouteParam(req: Request, name: string): string {
  const value = req.params[name];

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  throw new AppError(400, 'INVALID_ROUTE_PARAMETER', `Invalid ${name}`);
}

export function createDocumentsRouter(options: {
  service: DocumentService;
  access: DocumentAccessPolicy;
  authenticate: RequestHandler;
  upload: Multer | RequestHandler;
}) {
  const router = Router();

  const authorize = (mode: 'view' | 'upload'): RequestHandler =>
    async (req, _res, next) => {
      try {
        const user = req.authUser;

        if (!user) {
          throw new AppError(
            401,
            'AUTHENTICATION_REQUIRED',
            'Authentication required'
          );
        }

        const contractId = getRouteParam(req, 'contractId');

        const allowed =
          mode === 'view'
            ? await options.access.canView(user, contractId)
            : await options.access.canUpload(user, contractId);

        if (!allowed) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'You are not authorized to access this contract'
          );
        }

        next();
      } catch (error) {
        next(error);
      }
    };

  const uploadHandler: RequestHandler =
    typeof (options.upload as Multer).array === 'function'
      ? (options.upload as Multer).array('files')
      : options.upload as RequestHandler;

  const attachmentBases = [
    '/contracts/:contractId/attachments',
    '/forms/:contractId/attachments'
  ];

  // Upload attachments
  for (const base of attachmentBases) {
    router.post(
      base,
      options.authenticate,
      authorize('upload'),
      uploadHandler,
      async (req, res, next) => {
        const files = Array.isArray(req.files) ? req.files : [];

        try {
          const user = req.authUser!;

          const categoryValue = String(req.body.category ?? '');

          if (
            categoryValue === 'FINAL_PDF' ||
            categoryValue === AttachmentCategory.GENERATED_PDF
          ) {
            throw new AppError(
              400,
              'INVALID_ATTACHMENT_CATEGORY',
              'Generated PDF attachments are created by the system and cannot be uploaded'
            );
          }

          // QUOTATION is retained as a backwards-compatible API alias.

const category =
  categoryValue === 'QUOTATION'
    ? 'SUPPORTING'
    : categoryValue;

if (
  !USER_UPLOAD_CATEGORIES.includes(
    category as typeof USER_UPLOAD_CATEGORIES[number]
  )
) {
  throw new AppError(
    400,
    'INVALID_ATTACHMENT_CATEGORY',
    'Invalid attachment category'
  );
}

          if (!files.length) {
            throw new AppError(
              400,
              'NO_FILES_UPLOADED',
              'Select at least one file'
            );
          }

          const contractId = getRouteParam(req, 'contractId');
          const results = [];

          for (const file of files) {
            results.push(
              await options.service.upload({
                contractId,
                userId: user.id,
                category,
                file
              })
            );
          }

          await cleanupTemporaryUploads(files).catch(() => undefined);

          res.status(201).json({
            success: true,
            message: 'Attachments uploaded',
            data: results.map(({ driveFileId: _hidden, ...item }) => ({
              ...item,
              filename: item.fileName
            }))
          });
        } catch (error) {
          await cleanupTemporaryUploads(files).catch(() => undefined);
          next(error);
        }
      }
    );
  }

  // List attachments
  for (const base of attachmentBases) {
    router.get(
      base,
      options.authenticate,
      authorize('view'),
      async (req, res, next) => {
        try {
          const contractId = getRouteParam(req, 'contractId');

          const records = await options.service.list(contractId);

          res.json({
            success: true,
            data: records.map(item => ({
              ...item,
              filename: item.fileName
            }))
          });
        } catch (error) {
          next(error);
        }
      }
    );
  }

  // Download or view an attachment
  const sendFile = (
    disposition: 'attachment' | 'inline'
  ): RequestHandler =>
    async (req, res, next) => {
      try {
        const id = getRouteParam(req, 'id');
        const contractId = getRouteParam(req, 'contractId');

        const record = await options.service.get(id);

        if (record.contractFormId !== contractId) {
          throw new AppError(
            403,
            'FORBIDDEN',
            'Attachment does not belong to this contract'
          );
        }

        const { body } = await options.service.download(id);

        const safeName = record.fileName.replace(/[\r\n"\\]/g, '_');

        res.setHeader('Content-Type', record.mimeType);
        res.setHeader(
          'Content-Disposition',
          `${disposition}; filename="${safeName}"`
        );
        res.setHeader('X-Content-Type-Options', 'nosniff');

        body.on('error', next);
        body.pipe(res);
      } catch (error) {
        next(error);
      }
    };

  for (const base of attachmentBases) {
    const attachmentPath = `${base}/:id`;

    router.get(
      `${attachmentPath}/download`,
      options.authenticate,
      authorize('view'),
      sendFile('attachment')
    );

    router.get(
      `${attachmentPath}/view`,
      options.authenticate,
      authorize('view'),
      sendFile('inline')
    );
  }

  // Delete attachments
  for (const base of attachmentBases) {
    router.delete(
      `${base}/:id`,
      options.authenticate,
      authorize('upload'),
      async (req, res, next) => {
        try {
          const id = getRouteParam(req, 'id');
          const contractId = getRouteParam(req, 'contractId');

          const item = await options.service.get(id);

          if (item.contractFormId !== contractId) {
            throw new AppError(
              403,
              'FORBIDDEN',
              'Attachment does not belong to this contract'
            );
          }

          await options.service.remove(id);

          res.json({
            success: true,
            message: 'Attachment deleted',
            data: { id }
          });
        } catch (error) {
          next(error);
        }
      }
    );
  }

  // Document upload and application error handler
  router.use((error: unknown, req: Request, res: any, next: any) => {
    const uploadError = getDocumentUploadError(error);

    const normalized = uploadError
      ? new AppError(
          uploadError.statusCode,
          uploadError.code,
          uploadError.message
        )
      : error;

    if (normalized instanceof AppError) {
      res.status(normalized.statusCode).json({
        success: false,
        message: normalized.message,
        code: normalized.code,
        error: {
          code: normalized.code,
          details: normalized.details
        },
        meta: {
          requestId: req.requestId
        }
      });

      return;
    }

    next(normalized);
  });

  return router;
}
