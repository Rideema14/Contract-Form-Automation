import {
  DocumentUploadConfig,
  KNOWN_FILE_TYPES,
  DEFAULT_MAX_FILENAME_LENGTH,
} from './document.config';

export type FileValidationCode =
  | 'EMPTY_FILENAME'
  | 'INVALID_FILENAME'
  | 'FILENAME_TOO_LONG'
  | 'PATH_TRAVERSAL'
  | 'DANGEROUS_FILENAME'
  | 'MISSING_EXTENSION'
  | 'EXTENSION_NOT_ALLOWED'
  | 'MIME_NOT_ALLOWED'
  | 'MIME_EXTENSION_MISMATCH'
  | 'EMPTY_FILE'
  | 'INVALID_FILE_SIZE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_FILES'
  | 'NO_FILES';

export interface FileValidationIssue {
  code: FileValidationCode;
  message: string;
  /** Original filename the issue refers to (when applicable). */
  filename?: string;
}

export interface FileInput {
  originalName: string;
  mimeType: string;
  size: number;
}

export type FileValidationResult =
  | { ok: true; extension: string; mimeType: string }
  | { ok: false; issues: FileValidationIssue[] };

export class FileValidationError extends Error {
  readonly statusCode = 400;
  constructor(public readonly issues: FileValidationIssue[]) {
    super(issues.map((i) => i.message).join('; '));
    this.name = 'FileValidationError';
  }
}

// Characters that are control codes or illegal in Windows/POSIX filenames.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const ILLEGAL_CHARS = /[<>:"|?*]/;
/** Windows reserved device names (CON, NUL, COM1, ...). Shared with file.utils.ts. */
export const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Executable/script extensions. If one appears as an inner extension
 * ("invoice.exe.pdf") the name is treated as an attempt to disguise a file.
 */
const EXECUTABLE_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'dll', 'js', 'mjs', 'vbs', 'ps1',
  'sh', 'php', 'jar', 'jsp', 'asp', 'aspx', 'html', 'htm', 'svg', 'lnk',
]);

export function normalizeMimeType(mime: string): string {
  return (mime ?? '').split(';')[0].trim().toLowerCase();
}

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0 || idx === filename.length - 1) return '';
  return filename.slice(idx + 1).toLowerCase();
}

/** Detects path traversal, including URL-encoded and backslash variants. */
function hasPathTraversal(name: string): boolean {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    /* malformed encoding: fall through with the raw value */
  }
  return [name, decoded].some(
    (v) => /[\\/]/.test(v) || v.split(/[\\/]/).includes('..') || v.includes('..')
  );
}

/** Filename-only checks (no config needed apart from the length limit). */
export function validateFilename(
  originalName: unknown,
  maxLength: number = DEFAULT_MAX_FILENAME_LENGTH
): FileValidationIssue[] {
  const issues: FileValidationIssue[] = [];

  if (typeof originalName !== 'string' || originalName.trim() === '') {
    return [{ code: 'EMPTY_FILENAME', message: 'Filename is empty' }];
  }
  const filename = originalName;
  const add = (code: FileValidationCode, message: string) =>
    issues.push({ code, message, filename });

  if (CONTROL_CHARS.test(filename)) {
    add('INVALID_FILENAME', 'Filename contains control or null characters');
  }
  if (hasPathTraversal(filename)) {
    add('PATH_TRAVERSAL', 'Filename contains a path separator or traversal sequence');
  }
  if (ILLEGAL_CHARS.test(filename)) {
    add('INVALID_FILENAME', 'Filename contains illegal characters');
  }
  if (Buffer.byteLength(filename, 'utf8') > maxLength) {
    add('FILENAME_TOO_LONG', `Filename exceeds ${maxLength} bytes`);
  }

  const trimmed = filename.trim();
  if (/[. ]$/.test(filename)) {
    add('DANGEROUS_FILENAME', 'Filename ends with a dot or space');
  }
  if (trimmed.startsWith('.') && getExtension(trimmed) === '') {
    // ".htaccess", ".env" and similar dotfiles
    add('DANGEROUS_FILENAME', 'Hidden or dot-only filenames are not allowed');
  }

  const parts = trimmed.split('.');
  const base = parts[0];
  if (WINDOWS_RESERVED.test(base)) {
    add('DANGEROUS_FILENAME', 'Filename uses a reserved device name');
  }
  const innerExtensions = parts.slice(1, -1).map((p) => p.toLowerCase());
  if (innerExtensions.some((p) => EXECUTABLE_EXTENSIONS.has(p))) {
    add('DANGEROUS_FILENAME', 'Filename contains an executable extension');
  }

  return issues;
}

/** Validate one file against the supplied config. Never throws. */
export function validateFile(
  file: FileInput,
  config: DocumentUploadConfig
): FileValidationResult {
  const issues: FileValidationIssue[] = validateFilename(
    file.originalName,
    config.maxFilenameLength
  );
  const filename = typeof file.originalName === 'string' ? file.originalName : undefined;
  const add = (code: FileValidationCode, message: string) =>
    issues.push({ code, message, filename });

  const extension =
    typeof file.originalName === 'string' ? getExtension(file.originalName.trim()) : '';
  const mimeType = normalizeMimeType(file.mimeType);

  // Extension
  const nameIsUsable = !issues.some((i) => i.code === 'EMPTY_FILENAME');
  if (nameIsUsable) {
    if (extension === '') {
      add('MISSING_EXTENSION', 'File has no extension');
    } else if (!config.allowedExtensions.includes(extension)) {
      add('EXTENSION_NOT_ALLOWED', `File extension ".${extension}" is not allowed`);
    }
  }

  // MIME type (allowed set is derived from the allowed extensions)
  const allowedMimes = new Set(
    config.allowedExtensions.flatMap((ext) => KNOWN_FILE_TYPES[ext] ?? [])
  );
  if (!allowedMimes.has(mimeType)) {
    add('MIME_NOT_ALLOWED', `MIME type "${mimeType || 'unknown'}" is not allowed`);
  } else if (
    extension !== '' &&
    config.allowedExtensions.includes(extension) &&
    !(KNOWN_FILE_TYPES[extension] ?? []).includes(mimeType)
  ) {
    add(
      'MIME_EXTENSION_MISMATCH',
      `MIME type "${mimeType}" does not match extension ".${extension}"`
    );
  }

  // Size
  if (!Number.isFinite(file.size) || file.size < 0) {
    add('INVALID_FILE_SIZE', 'File size is invalid');
  } else if (file.size === 0) {
    add('EMPTY_FILE', 'File is empty');
  } else if (file.size > config.maxFileSizeBytes) {
    add('FILE_TOO_LARGE', `File exceeds the maximum size of ${config.maxFileSizeBytes} bytes`);
  }

  return issues.length === 0 ? { ok: true, extension, mimeType } : { ok: false, issues };
}

/** Validate the number of files in one request. */
export function validateFileCount(
  count: number,
  config: DocumentUploadConfig
): FileValidationIssue[] {
  if (count < 1) return [{ code: 'NO_FILES', message: 'No file was uploaded' }];
  if (count > config.maxFileCount) {
    return [
      {
        code: 'TOO_MANY_FILES',
        message: `A maximum of ${config.maxFileCount} files is allowed per upload`,
      },
    ];
  }
  return [];
}

/** Validate a batch: count first, then every file. Collects all issues. */
export function validateFiles(
  files: FileInput[],
  config: DocumentUploadConfig
): FileValidationResult[] | { ok: false; issues: FileValidationIssue[] } {
  const countIssues = validateFileCount(files.length, config);
  if (countIssues.length > 0) return { ok: false, issues: countIssues };
  return files.map((f) => validateFile(f, config));
}

/** Throwing variant for use in middleware/services. */
export function assertValidFile(file: FileInput, config: DocumentUploadConfig): void {
  const result = validateFile(file, config);
  if (!result.ok) throw new FileValidationError(result.issues);
}