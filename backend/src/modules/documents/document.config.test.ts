import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getDocumentUploadConfig,
  resetDocumentUploadConfigCache,
  DocumentConfigError,
} from './document.config';

afterEach(() => {
  vi.unstubAllEnvs();
  resetDocumentUploadConfigCache();
});

describe('getDocumentUploadConfig', () => {
  it('throws when settings are missing', () => {
    vi.stubEnv('DOCUMENT_ALLOWED_EXTENSIONS', '');
    vi.stubEnv('DOCUMENT_MAX_FILE_SIZE_BYTES', '');
    vi.stubEnv('DOCUMENT_MAX_FILE_COUNT', '');
    expect(() => getDocumentUploadConfig()).toThrow(DocumentConfigError);
  });

  it('loads once and returns the cached object', () => {
    vi.stubEnv('DOCUMENT_ALLOWED_EXTENSIONS', 'pdf');
    vi.stubEnv('DOCUMENT_MAX_FILE_SIZE_BYTES', '100');
    vi.stubEnv('DOCUMENT_MAX_FILE_COUNT', '1');
    const first = getDocumentUploadConfig();
    vi.stubEnv('DOCUMENT_MAX_FILE_COUNT', '9');
    expect(getDocumentUploadConfig()).toBe(first);
    expect(first.maxFileCount).toBe(1);
  });
});
