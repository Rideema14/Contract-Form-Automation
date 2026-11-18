import { Request, RequestHandler, Response, Router } from 'express';
import { pipeline } from 'node:stream';
import { z } from 'zod';
import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/response';
import { AttachmentRecord, USER_UPLOAD_CATEGORIES } from './attachment.types';
import { AccessUser } from './attachment-access';
import { DocumentService } from './document.service';

export interface AttachmentsRouterDeps {
  service: DocumentService;
  authenticate: RequestHandler;
  /** contractService.assertCanUploadAttachments (creator, DRAFT or RETURNED). */
  assertCanUpload(formId: string, user: AccessUser): Promise<void>;
  /** Admin, creator or assigned approver. */
  assertCanView(formId: string, user: AccessUser): Promise<void>;
  /** configured Multer middleware (field "files"). */
  upload: RequestHandler;
  /** Optional: generate the final PDF on demand (ADMIN only). */
  ensureFinalPdf?(formId: string, user: AccessUser): Promise<AttachmentRecord>;
}

const formParams = z.object({ formId: z.string().uuid() }).strict();
const attachmentParams = z.object({ formId: z.string().uuid(), attachmentId: z.string().uuid() }).strict();
const uploadBody = z.object({ category: z.enum(USER_UPLOAD_CATEGORIES) });

const INLINE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

/** Public shape: the private Drive id is never included. */
export function toPublicAttachment(r: AttachmentRecord) {
  return {
    id: r.id,
    contractFormId: r.contractFormId,
    category: r.category,
    fileName: r.fileName,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    uploadedById: r.uploadedById,
    createdAt: r.createdAt.toISOString(),
  };
}

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', message, result.error.issues);
  return result.data;
}

function currentUser(req: Request): AccessUser {
  if (!req.authUser) throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  return req.authUser;
}

function contentDisposition(type: 'attachment' | 'inline', fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Routes (mounted under /api/forms):
 *   POST /:formId/attachments                       multipart: files + category
 *   GET  /:formId/attachments
 *   GET  /:formId/attachments/:attachmentId/download
 *   GET  /:formId/attachments/:attachmentId/view
 *   POST /:formId/final-pdf                          ADMIN only, idempotent
 */
export function createAttachmentsRouter(deps: AttachmentsRouterDeps): Router {
  const { service, authenticate, assertCanUpload, assertCanView, upload } = deps;
  const router = Router();

  const guard =
    (check: AttachmentsRouterDeps['assertCanView']): RequestHandler =>
    async (req, _res, next) => {
      try {
        const { formId } = parse(formParams.pick({ formId: true }), { formId: req.params.formId }, 'Invalid contract form ID');
        await check(formId, currentUser(req));
        next();
      } catch (error) {
        next(error);
      }
    };

  // Permission is checked BEFORE the upload middleware: unauthorised users cannot write temp files.
  router.post(
    '/:formId/attachments',
    authenticate,
    guard(assertCanUpload),
    upload,
    async (req: Request, res: Response) => {
      const { category } = parse(uploadBody, req.body ?? {}, 'Invalid attachment category');
      const records = await service.uploadAttachments({
        contractFormId: String(req.params.formId),
        category,
        uploadedById: currentUser(req).id,
        files: Array.isArray(req.files) ? req.files : [],
      });
      sendSuccess(req, res, 201, 'Attachments uploaded', records.map(toPublicAttachment));
    }
  );

  router.get('/:formId/attachments', authenticate, guard(assertCanView), async (req, res) => {
    const records = await service.list(String(req.params.formId));
    sendSuccess(req, res, 200, 'Attachments retrieved', records.map(toPublicAttachment));
  });

  const send =
    (mode: 'download' | 'view'): RequestHandler =>
    async (req, res) => {
      const { formId, attachmentId } = parse(attachmentParams, req.params, 'Invalid identifiers');
      const { record, stream } = await service.openAttachment(formId, attachmentId);
      const inline = mode === 'view' && INLINE_TYPES.has(record.mimeType);
      res.setHeader('Content-Type', record.mimeType);
      res.setHeader('Content-Disposition', contentDisposition(inline ? 'inline' : 'attachment', record.fileName));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      if (record.sizeBytes) res.setHeader('Content-Length', String(record.sizeBytes));
      pipeline(stream, res, () => undefined);
    };

  router.get('/:formId/attachments/:attachmentId/download', authenticate, guard(assertCanView), send('download'));
  router.get('/:formId/attachments/:attachmentId/view', authenticate, guard(assertCanView), send('view'));

  if (deps.ensureFinalPdf) {
    const ensure = deps.ensureFinalPdf;
    router.post('/:formId/final-pdf', authenticate, async (req, res) => {
      const user = currentUser(req);
      if (user.role !== 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'Only administrators can generate the final PDF');
      const { formId } = parse(formParams, req.params, 'Invalid contract form ID');
      sendSuccess(req, res, 200, 'Final PDF ready', toPublicAttachment(await ensure(formId, user)));
    });
  }

  return router;
}
