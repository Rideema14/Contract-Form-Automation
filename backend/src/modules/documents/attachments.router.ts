import { Request, RequestHandler, Response, Router } from 'express';
import { pipeline } from 'node:stream';
import { z } from 'zod';
import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/response';
import { AttachmentRecord, USER_UPLOAD_CATEGORIES } from './attachment.types';
import { DocumentService } from './document.service';
import { FinalPdfPackage } from './final-pdf.service';

export interface AccessUser {
  id: string;
  role: string;
}

export interface AttachmentsRouterDeps {
  service: DocumentService;
  authenticate: RequestHandler;
  /** contractService.assertCanUploadAttachments (creator, DRAFT or RETURNED). */
  assertCanUpload(formId: string, user: AccessUser): Promise<void>;
  /** Admin, creator or assigned approver. */
  assertCanView(formId: string, user: AccessUser): Promise<void>;
  /** Admin, or the creator while the contract is DRAFT or RETURNED. */
  assertCanDelete(formId: string, user: AccessUser): Promise<void>;
  /** Records a completed attachment deletion in the contract audit history. */
  recordDeletion(formId: string, attachment: AttachmentRecord, user: AccessUser): Promise<void>;
  /** Returns a safe, human-readable Drive folder name for this authorized contract. */
  getContractFolderName(formId: string, user: AccessUser): Promise<string>;
  /** configured Multer middleware (field "files"). */
  upload: RequestHandler;
  /** Optional: generate and return the approved contract package. */
  generatePackage?(formId: string, user: AccessUser): Promise<FinalPdfPackage>;
}

const formParams = z.object({ formId: z.string().uuid() }).strict();
const attachmentParams = z.object({ formId: z.string().uuid(), attachmentId: z.string().uuid() }).strict();
const uploadBody = z.object({
  category: z.enum(USER_UPLOAD_CATEGORIES),
  displayNames: z.union([z.string(), z.array(z.string())]).optional(),
});
const displayName = z
  .string()
  .trim()
  .min(1, 'Display name cannot be blank')
  .max(255, 'Display name cannot exceed 255 characters')
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), 'Display name cannot contain control characters');

const INLINE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

/** Public shape: the private Drive id is never included. */
export function toPublicAttachment(r: AttachmentRecord) {
  return {
    id: r.id,
    contractFormId: r.contractFormId,
    category: r.category,
    fileName: r.fileName,
    originalFileName: r.originalFileName ?? r.fileName,
    displayName: r.displayName ?? r.fileName,
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
 *   POST /:formId/attachments                       multipart: files + category + repeated displayNames
 *   GET  /:formId/attachments
 *   DELETE /:formId/attachments/:attachmentId
 *   GET  /:formId/attachments/:attachmentId/download
 *   GET  /:formId/attachments/:attachmentId/view
 *   POST /:formId/final-pdf                          ADMIN or assigned APPROVER
 */
export function createAttachmentsRouter(deps: AttachmentsRouterDeps): Router {
  const { service, authenticate, assertCanUpload, assertCanView, assertCanDelete, upload } = deps;
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
      const { category, displayNames: submittedNames } = parse(uploadBody, req.body ?? {}, 'Invalid attachment metadata');
      const files = Array.isArray(req.files) ? req.files : [];
      const rawNames = submittedNames === undefined
        ? files.map((file) => file.originalname)
        : Array.isArray(submittedNames)
          ? submittedNames
          : [submittedNames];
      const parsedNames = z.array(displayName).safeParse(rawNames);
      if (!parsedNames.success || parsedNames.data.length !== files.length) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Provide one valid display name for each uploaded file',
          parsedNames.success
            ? [{ path: ['displayNames'], message: 'The number of display names must match the number of files' }]
            : parsedNames.error.issues
        );
      }
      const formId = String(req.params.formId);
      const user = currentUser(req);
      const records = await service.uploadAttachments({
        contractFormId: formId,
        contractFolderName: await deps.getContractFolderName(formId, user),
        category,
        uploadedById: user.id,
        files,
        displayNames: parsedNames.data,
      });
      sendSuccess(req, res, 201, 'Attachments uploaded', records.map(toPublicAttachment));
    }
  );

  router.get('/:formId/attachments', authenticate, guard(assertCanView), async (req, res) => {
    const records = await service.list(String(req.params.formId));
    sendSuccess(req, res, 200, 'Attachments retrieved', records.map(toPublicAttachment));
  });

  router.delete(
    '/:formId/attachments/:attachmentId',
    authenticate,
    guard(assertCanDelete),
    async (req, res) => {
      const { formId, attachmentId } = parse(attachmentParams, req.params, 'Invalid identifiers');
      const user = currentUser(req);
      const record = await service.deleteAttachment(formId, attachmentId);
      try {
        await deps.recordDeletion(formId, record, user);
      } catch (error) {
        console.error('Failed to record attachment deletion in audit history', {
          formId,
          attachmentId,
          error,
        });
        throw new AppError(
          500,
          'ATTACHMENT_AUDIT_FAILED',
          'The attachment was deleted, but its audit record could not be saved. Contact an administrator.'
        );
      }
      sendSuccess(req, res, 200, 'Attachment deleted', { id: record.id });
    }
  );

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

  if (deps.generatePackage) {
    const generatePackage = deps.generatePackage;
    router.post('/:formId/final-pdf', authenticate, async (req, res) => {
      const user = currentUser(req);
      const { formId } = parse(formParams, req.params, 'Invalid contract form ID');
      if (user.role !== 'ADMIN' && user.role !== 'APPROVER') {
        throw new AppError(403, 'FORBIDDEN', 'Only administrators and approvers can download the contract package');
      }
      await assertCanView(formId, user);
      const file = await generatePackage(formId, user);
      res
        .status(200)
        .setHeader('Content-Type', 'application/zip')
        .setHeader('Content-Disposition', contentDisposition('attachment', file.fileName))
        .setHeader('Content-Length', String(file.content.length))
        .setHeader('Cache-Control', 'private, no-store')
        .send(file.content);
    });
  }

  return router;
}
