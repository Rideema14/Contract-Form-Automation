
import { describe, expect, it } from 'vitest';

import {
  parseDocumentUploadConfig,
  DocumentConfigError,
  loadDocumentUploadConfig,
} from './document.config';

describe('Document upload configuration', () => {
  const validConfig = {
    allowedExtensions: ['pdf', 'xlsx', 'csv'],
    maxFileSizeBytes: 5 * 1024 * 1024,
    maxFileCount: 5,
  };

  it('accepts valid configuration', () => {
    const result = parseDocumentUploadConfig(validConfig);

    expect(result.allowedExtensions).toEqual(['pdf', 'xlsx', 'csv']);
    expect(result.maxFileSizeBytes).toBe(5 * 1024 * 1024);
    expect(result.maxFileCount).toBe(5);
  });

  it('rejects an empty extension allow-list', () => {
    expect(() =>
      parseDocumentUploadConfig({
        ...validConfig,
        allowedExtensions: [],
      })
    ).toThrow(DocumentConfigError);
  });

  it('rejects unsupported extensions', () => {
    expect(() =>
      parseDocumentUploadConfig({
        ...validConfig,
        allowedExtensions: ['exe'],
      })
    ).toThrow(DocumentConfigError);
  });

  it('rejects extensions containing a dot', () => {
    expect(() =>
      parseDocumentUploadConfig({
        ...validConfig,
        allowedExtensions: ['.pdf'],
      })
    ).toThrow(DocumentConfigError);
  });

  it('rejects a zero file-size limit', () => {
    expect(() =>
      parseDocumentUploadConfig({
        ...validConfig,
        maxFileSizeBytes: 0,
      })
    ).toThrow(DocumentConfigError);
  });

  it('rejects a negative file-count limit', () => {
    expect(() =>
      parseDocumentUploadConfig({
        ...validConfig,
        maxFileCount: -1,
      })
    ).toThrow(DocumentConfigError);
  });

  it('applies the default maximum filename length', () => {
    const result = parseDocumentUploadConfig(validConfig);

    expect(result.maxFilenameLength).toBe(255);
  });

  it('rejects missing required environment variables', () => {
    expect(() =>
      loadDocumentUploadConfig({})
    ).toThrow(DocumentConfigError);
  });

  it('loads valid environment configuration', () => {
    const result = loadDocumentUploadConfig({
      DOCUMENT_ALLOWED_EXTENSIONS: 'pdf,xlsx,csv',
      DOCUMENT_MAX_FILE_SIZE_BYTES: '5242880',
      DOCUMENT_MAX_FILE_COUNT: '5',
    });

    expect(result.allowedExtensions).toEqual(['pdf', 'xlsx', 'csv']);
    expect(result.maxFileSizeBytes).toBe(5242880);
    expect(result.maxFileCount).toBe(5);
  });
});
