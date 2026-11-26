
import { describe, expect, it } from 'vitest';
import { MulterError } from 'multer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import {
  createDocumentUpload,
  getDocumentUploadError,
  prepareDocumentStorageFilename,
  validateUploadedDocument,
  cleanupTemporaryUpload,
} from './upload.middleware';

import { FileValidationError } from './file.validator';
import { parseDocumentUploadConfig } from './document.config';

const testConfig = parseDocumentUploadConfig({
  allowedExtensions: ['pdf', 'xlsx', 'csv'],
  maxFileSizeBytes: 1024 * 1024,
  maxFileCount: 5,
});

const temporaryDirectory = path.join(
  os.tmpdir(),
  'contract-forms-automation',
  'document-uploads'
);

function makeUploadedFile(
  overrides: Partial<Express.Multer.File> = {}
): Express.Multer.File {
  return {
    fieldname: 'documents',
    originalname: 'report.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 100,
    destination: temporaryDirectory,
    filename: 'test-file.pdf',
    path: path.join(temporaryDirectory, 'test-file.pdf'),
    ...overrides,
  } as Express.Multer.File;
}

describe('Document upload middleware', () => {
  describe('createDocumentUpload', () => {
    it('creates a Multer upload instance with valid configuration', () => {
      const upload = createDocumentUpload(testConfig);

      expect(upload).toBeDefined();
      expect(typeof upload.single).toBe('function');
      expect(typeof upload.array).toBe('function');
    });

    it('creates an upload instance using the configured file count', () => {
      const upload = createDocumentUpload({
        ...testConfig,
        maxFileCount: 3,
      });

      expect(upload).toBeDefined();
    });
  });

  describe('getDocumentUploadError', () => {
    it('returns null for an unknown error', () => {
      expect(
        getDocumentUploadError(new Error('Unknown error'))
      ).toBeNull();
    });

    it('converts a Multer file-size error', () => {
      const error = new MulterError('LIMIT_FILE_SIZE');

      expect(getDocumentUploadError(error)).toEqual({
        statusCode: 413,
        code: 'LIMIT_FILE_SIZE',
        message: 'The uploaded file exceeds the configured size limit.',
      });
    });

    it('converts a Multer file-count error', () => {
      const error = new MulterError('LIMIT_FILE_COUNT');

      expect(getDocumentUploadError(error)).toEqual({
        statusCode: 400,
        code: 'LIMIT_FILE_COUNT',
        message: 'Too many files were uploaded.',
      });
    });

    it('converts an unexpected file field error', () => {
      const error = new MulterError('LIMIT_UNEXPECTED_FILE');

      expect(getDocumentUploadError(error)).toEqual({
        statusCode: 400,
        code: 'LIMIT_UNEXPECTED_FILE',
        message: 'An unexpected file field was received.',
      });
    });

    it('converts a document validation error', () => {
      const error = new FileValidationError([
        {
          code: 'EXTENSION_NOT_ALLOWED',
          message: 'Extension is not allowed.',
          filename: 'program.exe',
        },
      ]);

      const result = getDocumentUploadError(error);

      expect(result?.statusCode).toBe(400);
      expect(result?.code).toBe('DOCUMENT_VALIDATION_FAILED');
      expect(result?.message).toContain('Extension is not allowed.');
    });
  });

  describe('prepareDocumentStorageFilename', () => {
    it('creates a storage filename with a safe extension', () => {
      const result = prepareDocumentStorageFilename('report.pdf');

      expect(result).toMatch(/\.pdf$/);
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
    });

    it('removes directory traversal from the original filename', () => {
      const result = prepareDocumentStorageFilename('../../report.pdf');

      expect(result).toMatch(/\.pdf$/);
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
    });

    it('generates unique names for repeated uploads', () => {
      const first = prepareDocumentStorageFilename('report.pdf');
      const second = prepareDocumentStorageFilename('report.pdf');

      expect(first).not.toBe(second);
    });
  });

  describe('validateUploadedDocument', () => {
    it('accepts a valid uploaded document', () => {
      const file = makeUploadedFile();

      expect(() => {
        validateUploadedDocument(file, testConfig);
      }).not.toThrow();
    });

    it('rejects an empty uploaded document', () => {
      const file = makeUploadedFile({ size: 0 });

      expect(() => {
        validateUploadedDocument(file, testConfig);
      }).toThrow(FileValidationError);
    });

    it('rejects a MIME type that does not match the extension', () => {
      const file = makeUploadedFile({
        mimetype: 'application/json',
      });

      expect(() => {
        validateUploadedDocument(file, testConfig);
      }).toThrow(FileValidationError);
    });

    it('rejects an extension that is not configured', () => {
      const file = makeUploadedFile({
        originalname: 'program.exe',
        mimetype: 'application/octet-stream',
      });

      expect(() => {
        validateUploadedDocument(file, testConfig);
      }).toThrow(FileValidationError);
    });

    it('rejects a file exceeding the configured size limit', () => {
      const file = makeUploadedFile({
        size: testConfig.maxFileSizeBytes + 1,
      });

      expect(() => {
        validateUploadedDocument(file, testConfig);
      }).toThrow(FileValidationError);
    });
  });

  describe('cleanupTemporaryUpload', () => {
    it('removes a temporary uploaded file', async () => {
      await fs.mkdir(temporaryDirectory, { recursive: true });

      const filename = `test-${randomUUID()}.pdf`;
      const filePath = path.join(temporaryDirectory, filename);

      await fs.writeFile(filePath, 'temporary test content');

      const file = makeUploadedFile({
        filename,
        path: filePath,
      });

      await cleanupTemporaryUpload(file);

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it('refuses to remove a file outside the temporary upload directory', async () => {
      const outsidePath = path.join(
        os.tmpdir(),
        `outside-${randomUUID()}.pdf`
      );

      const file = makeUploadedFile({
        path: outsidePath,
      });

      await expect(cleanupTemporaryUpload(file)).rejects.toThrow(
        'Refusing to remove a file outside the upload directory'
      );
    });
  });
});
