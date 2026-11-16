
import multer, { MulterError } from 'multer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  DocumentUploadConfig,
  KNOWN_FILE_TYPES,
  DEFAULT_MAX_FILENAME_LENGTH,
} from './document.config';

import {
  FileValidationError,
  assertValidFile,
  validateFilename,
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
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: config.maxFileCount,
    },
    fileFilter: (_req, file, callback) => {
      const filenameIssues = validateFilename(
        file.originalname,
        config.maxFilenameLength
      );
      const extension = path.extname(file.originalname)
  .slice(1)
  .toLowerCase();

const mimeType = file.mimetype.trim().toLowerCase();

if (!extension) {
  callback(
    new FileValidationError([
      {
        code: 'MISSING_EXTENSION',
        message: 'The uploaded file must have an extension.',
        filename: file.originalname,
      },
    ])
  );
  return;
}

if (!config.allowedExtensions.includes(extension)) {
  callback(
    new FileValidationError([
      {
        code: 'EXTENSION_NOT_ALLOWED',
        message: `File extension ".${extension}" is not allowed.`,
        filename: file.originalname,
      },
    ])
  );
  return;
}

if (!KNOWN_FILE_TYPES[extension]?.includes(mimeType)) {
  callback(
    new FileValidationError([
      {
        code: 'MIME_EXTENSION_MISMATCH',
        message: 'File MIME type does not match its extension.',
        filename: file.originalname,
      },
    ])
  );
  return;
}

      if (filenameIssues.length > 0) {
        callback(new FileValidationError(filenameIssues));
        return;
      }

      callback(null, true);
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
