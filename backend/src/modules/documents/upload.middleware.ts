import multer, { MulterError } from 'multer';
import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  DocumentUploadConfig,
  DEFAULT_MAX_FILENAME_LENGTH,
} from './document.config';

import {
  FileValidationError,
  assertValidFile,
  validateFile,
  validateFileCount,
  type FileValidationIssue,
} from './file.validator';

import {
  sanitizeFilename,
  createStorageFilename,
} from './file.utils';

const TEMP_UPLOAD_DIRECTORY = path.join(
  os.tmpdir(),
  'contract-forms-automation',
  'document-uploads'
);

export function createDocumentUpload(config: DocumentUploadConfig) {
  const storage = multer.diskStorage({
    destination: (_req, _file, callback) => {
      fs.mkdir(TEMP_UPLOAD_DIRECTORY, { recursive: true })
        .then(() => callback(null, TEMP_UPLOAD_DIRECTORY))
        .catch((error: Error) => callback(error, TEMP_UPLOAD_DIRECTORY));
    },

    filename: (_req, file, callback) => {
      try {
        const safeName = sanitizeFilename(
          file.originalname,
          config.maxFilenameLength
        );

        callback(null, createStorageFilename(safeName));
      } catch (error) {
        callback(error as Error, '');
      }
    },
  });

  return multer({
    storage,
    // Keep the client's full path in file.originalname so validateFile can
    // REJECT traversal attempts. By default Multer silently strips the
    // directory part, which would hide them from the validator.
    preservePath: true,
    // Browsers send filenames as UTF-8; Multer's default (latin1) garbles
    // accented and non-Latin names.
    defParamCharset: 'utf8',
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: config.maxFileCount,
    },
    fileFilter: (_req, file, callback) => {
      // Single source of truth: the same rules as file.validator.ts. The real
      // size is unknown here (limits.fileSize enforces the maximum while
      // streaming; zero-byte files are caught after upload), so pass 1.
      const result = validateFile(
        { originalName: file.originalname, mimeType: file.mimetype, size: 1 },
        config
      );

      if (result.ok) {
        callback(null, true);
      } else {
        callback(new FileValidationError(result.issues));
      }
    },
  });
}

export function prepareDocumentStorageFilename(
  originalFilename: string,
  maxFilenameLength = DEFAULT_MAX_FILENAME_LENGTH
): string {
  const safeFilename = sanitizeFilename(
    originalFilename,
    maxFilenameLength
  );

  return createStorageFilename(safeFilename);
}

export function validateUploadedDocument(
  file: Express.Multer.File,
  config: DocumentUploadConfig
): void {
  assertValidFile(
    {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    },
    config
  );
}

export async function cleanupTemporaryUpload(
  file: Express.Multer.File
): Promise<void> {
  const directory = path.resolve(TEMP_UPLOAD_DIRECTORY);
  const filePath = path.resolve(file.path);

  if (path.dirname(filePath) !== directory) {
    throw new Error(
      'Refusing to remove a file outside the upload directory'
    );
  }

  await fs.rm(filePath, { force: true });
}

export async function cleanupTemporaryUploads(
  files: Express.Multer.File[]
): Promise<void> {
  await Promise.all(files.map(cleanupTemporaryUpload));
}

export function getDocumentUploadError(error: unknown): {
  statusCode: number;
  code: string;
  message: string;
} | null {
  if (error instanceof FileValidationError) {
    return {
      statusCode: error.statusCode,
      code: 'DOCUMENT_VALIDATION_FAILED',
      message: error.message,
    };
  }

  if (error instanceof MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'The uploaded file exceeds the configured size limit.',
      LIMIT_FILE_COUNT: 'Too many files were uploaded.',
      LIMIT_UNEXPECTED_FILE: 'An unexpected file field was received.',
      LIMIT_PART_COUNT: 'Too many multipart form parts were received.',
      LIMIT_FIELD_COUNT: 'Too many text fields were received.',
      LIMIT_FIELD_KEY: 'A form field name is too long.',
      LIMIT_FIELD_VALUE: 'A form field value is too long.',
    };

    return {
      statusCode: 400,
      code: error.code,
      message: messages[error.code] ?? 'Document upload failed.',
    };
  }

  return null;
}

/** Deletes the temporary files of a request. Never throws. */
async function cleanupRequestFiles(req: Request): Promise<void> {
  const files = Array.isArray(req.files) ? req.files : [];
  await Promise.allSettled(files.map(cleanupTemporaryUpload));
}

/**
 * Ready-to-mount middleware: Multer (rules from `config`) plus the checks that
 * need the real file size (zero-byte files, file count).
 *
 * - On any rejection the temporary files are deleted and the error is passed
 *   to next() (use documentUploadErrorHandler to turn it into a response).
 * - On success req.files holds the saved files, which are deleted
 *   automatically when the response closes. Move them to their final
 *   destination (for example Google Drive) before responding.
 *
 * NOT connected to any route yet.
 */
export function createDocumentUploadMiddleware(
  config: DocumentUploadConfig,
  fieldName: string
): RequestHandler {
  if (typeof fieldName !== 'string' || fieldName.trim() === '') {
    throw new TypeError('fieldName is required');
  }
  const upload = createDocumentUpload(config).array(fieldName);

  return (req, res, next) => {
    res.once('close', () => {
      void cleanupRequestFiles(req);
    });

    upload(req, res, (error?: unknown) => {
      const reject = (reason: unknown) => {
        void cleanupRequestFiles(req).then(() => next(reason));
      };

      if (error) {
        reject(error);
        return;
      }

      const files = Array.isArray(req.files) ? req.files : [];
      const issues: FileValidationIssue[] = validateFileCount(files.length, config);

      for (const file of files) {
        const result = validateFile(
          { originalName: file.originalname, mimeType: file.mimetype, size: file.size },
          config
        );
        if (!result.ok) issues.push(...result.issues);
      }

      if (issues.length > 0) {
        reject(new FileValidationError(issues));
        return;
      }

      next();
    });
  };
}

/**
 * Express error handler for upload errors. Other errors go to the next
 * handler. The response shape is PROVISIONAL until the team agrees the shared
 * error envelope; change it here, in one place.
 */
export const documentUploadErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  const info = getDocumentUploadError(err);

  if (!info) {
    next(err);
    return;
  }

  res.status(info.statusCode).json({
    success: false,
    message: info.message,
    code: info.code,
    ...(err instanceof FileValidationError ? { issues: err.issues } : {}),
  });
};