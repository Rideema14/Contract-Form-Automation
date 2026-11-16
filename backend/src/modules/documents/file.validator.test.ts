import { describe, it, expect } from 'vitest';
import {
  validateFile,
  validateFiles,
  validateFileCount,
  validateFilename,
  assertValidFile,
  FileValidationError,
  FileInput,
} from './file.validator';
import {
  DocumentUploadConfig,
  parseDocumentUploadConfig,
  loadDocumentUploadConfig,
  DocumentConfigError,
} from './document.config';

// Test-only values. These are NOT project decisions (see CL-14).
const config: DocumentUploadConfig = parseDocumentUploadConfig({
  allowedExtensions: ['pdf', 'xlsx'],
  maxFileSizeBytes: 1000,
  maxFileCount: 2,
});

const PDF = 'application/pdf';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const file = (o: Partial<FileInput> = {}): FileInput => ({
  originalName: 'quote.pdf',
  mimeType: PDF,
  size: 100,
  ...o,
});
const codes = (f: FileInput) => {
  const r = validateFile(f, config);
  return r.ok ? [] : r.issues.map((i) => i.code);
};

describe('valid files', () => {
  it('accepts allowed pdf and xlsx files', () => {
    expect(validateFile(file(), config)).toEqual({ ok: true, extension: 'pdf', mimeType: PDF });
    expect(validateFile(file({ originalName: 'Cost.XLSX', mimeType: XLSX }), config).ok).toBe(true);
  });
  it('ignores MIME parameters and case', () => {
    expect(validateFile(file({ mimeType: 'Application/PDF; charset=binary' }), config).ok).toBe(true);
  });
  it('accepts a file exactly at the size limit', () => {
    expect(validateFile(file({ size: 1000 }), config).ok).toBe(true);
  });
});

describe('extension and MIME checks', () => {
  it('rejects disallowed extensions', () => {
    expect(codes(file({ originalName: 'a.docx' }))).toContain('EXTENSION_NOT_ALLOWED');
  });
  it('rejects files without an extension', () => {
    expect(codes(file({ originalName: 'quote' }))).toContain('MISSING_EXTENSION');
  });
  it('rejects MIME types outside the allowed set', () => {
    expect(codes(file({ mimeType: 'application/x-msdownload' }))).toContain('MIME_NOT_ALLOWED');
    expect(codes(file({ mimeType: '' }))).toContain('MIME_NOT_ALLOWED');
  });
  it('rejects an allowed MIME type that does not match the extension', () => {
    expect(codes(file({ originalName: 'quote.pdf', mimeType: XLSX }))).toEqual([
      'MIME_EXTENSION_MISMATCH',
    ]);
  });
});

describe('size and count', () => {
  it('rejects files over the size limit', () => {
    expect(codes(file({ size: 1001 }))).toEqual(['FILE_TOO_LARGE']);
  });
  it('rejects empty files', () => {
    expect(codes(file({ size: 0 }))).toEqual(['EMPTY_FILE']);
  });
  it('rejects invalid sizes', () => {
    expect(codes(file({ size: -5 }))).toEqual(['INVALID_FILE_SIZE']);
    expect(codes(file({ size: NaN }))).toEqual(['INVALID_FILE_SIZE']);
  });
  it('rejects too many files and zero files', () => {
    expect(validateFileCount(3, config)[0].code).toBe('TOO_MANY_FILES');
    expect(validateFileCount(0, config)[0].code).toBe('NO_FILES');
    expect(validateFileCount(2, config)).toEqual([]);
  });
  it('validateFiles checks count before individual files', () => {
    const many = validateFiles([file(), file(), file()], config);
    expect(Array.isArray(many)).toBe(false);
    const each = validateFiles([file(), file({ size: 0 })], config);
    expect(Array.isArray(each) && each.map((r) => r.ok)).toEqual([true, false]);
  });
});

describe('filenames', () => {
  it('rejects empty or whitespace filenames', () => {
    expect(codes(file({ originalName: '' }))).toContain('EMPTY_FILENAME');
    expect(codes(file({ originalName: '   ' }))).toContain('EMPTY_FILENAME');
  });
  it('rejects non-string filenames without throwing', () => {
    expect(codes(file({ originalName: undefined as unknown as string }))).toContain(
      'EMPTY_FILENAME'
    );
  });
  it.each([
    '../../etc/passwd.pdf',
    '..\\..\\windows\\system.pdf',
    'folder/quote.pdf',
    '%2e%2e%2fsecret.pdf',
    '..%5cquote.pdf',
    'a..b.pdf',
  ])('flags path traversal: %s', (name) => {
    expect(codes(file({ originalName: name }))).toContain('PATH_TRAVERSAL');
  });
  it('rejects null bytes and control characters', () => {
    expect(codes(file({ originalName: 'quote.pdf\u0000.exe' }))).toContain('INVALID_FILENAME');
    expect(codes(file({ originalName: 'qu\note.pdf' }))).toContain('INVALID_FILENAME');
  });
  it('rejects illegal characters', () => {
    expect(codes(file({ originalName: 'qu<ot>e.pdf' }))).toContain('INVALID_FILENAME');
  });
  it.each(['CON.pdf', 'nul.pdf', 'COM1.pdf', 'invoice.exe.pdf', 'quote.pdf.', 'quote.pdf ', '.htaccess'])(
    'flags dangerous filename: %s',
    (name) => {
      expect(codes(file({ originalName: name }))).toContain('DANGEROUS_FILENAME');
    }
  );
  it('rejects overlong filenames', () => {
    expect(validateFilename('a'.repeat(300) + '.pdf')[0].code).toBe('FILENAME_TOO_LONG');
  });
  it('accepts normal names with spaces, unicode and extra dots', () => {
    expect(validateFilename('Q3 quotation v1.2 (final).pdf')).toEqual([]);
    expect(validateFilename('عرض سعر.pdf')).toEqual([]);
  });
});

describe('assertValidFile', () => {
  it('throws FileValidationError with issues', () => {
    expect(() => assertValidFile(file({ size: 0 }), config)).toThrow(FileValidationError);
    expect(() => assertValidFile(file(), config)).not.toThrow();
  });
});

describe('configuration', () => {
  it('fails closed when policy values are missing (CL-14)', () => {
    try {
      loadDocumentUploadConfig({});
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DocumentConfigError);
      expect((e as DocumentConfigError).missing).toEqual([
        'DOCUMENT_ALLOWED_EXTENSIONS',
        'DOCUMENT_MAX_FILE_SIZE_BYTES',
        'DOCUMENT_MAX_FILE_COUNT',
      ]);
    }
  });
  it('loads from environment variables', () => {
    const cfg = loadDocumentUploadConfig({
      DOCUMENT_ALLOWED_EXTENSIONS: ' .PDF, xlsx ',
      DOCUMENT_MAX_FILE_SIZE_BYTES: '5000',
      DOCUMENT_MAX_FILE_COUNT: '3',
    });
    expect(cfg.allowedExtensions).toEqual(['pdf', 'xlsx']);
    expect(cfg.maxFileSizeBytes).toBe(5000);
    expect(cfg.maxFileCount).toBe(3);
    expect(cfg.maxFilenameLength).toBe(255);
  });
  it('rejects unknown extensions and bad numbers', () => {
    expect(() =>
      parseDocumentUploadConfig({ allowedExtensions: ['exe'], maxFileSizeBytes: 1, maxFileCount: 1 })
    ).toThrow(DocumentConfigError);
    expect(() =>
      loadDocumentUploadConfig({
        DOCUMENT_ALLOWED_EXTENSIONS: 'pdf',
        DOCUMENT_MAX_FILE_SIZE_BYTES: 'abc',
        DOCUMENT_MAX_FILE_COUNT: '1',
      })
    ).toThrow(DocumentConfigError);
  });
});