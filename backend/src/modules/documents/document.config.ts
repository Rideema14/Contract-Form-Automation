import { z } from 'zod';

/**
 * Upload rules for the documents module.
 *
 * IMPORTANT: the project requirements (docs/02-requirements.md, CL-14) do not
 * yet state the allowed file types, maximum sizes or retention period. No
 * policy values are therefore hard-coded here. They must be supplied through
 * configuration, and loading fails closed (throws) when they are missing.
 */

/**
 * Technical lookup: which MIME types a browser/OS may legitimately report for a
 * given extension. This is NOT an allow-list. It only lets us (a) check that an
 * extension and a MIME type belong together and (b) refuse configuration that
 * names an extension we cannot verify. The allow-list itself comes from config.
 */
export const KNOWN_FILE_TYPES: Readonly<Record<string, readonly string[]>> = {
  pdf: ['application/pdf'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  csv: ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  txt: ['text/plain'],
};

/** Technical filesystem limit (most filesystems allow 255 bytes per name). */
export const DEFAULT_MAX_FILENAME_LENGTH = 255;

export const documentUploadConfigSchema = z.object({
  allowedExtensions: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+$/, 'Extensions must be letters/digits only, without a dot')
    )
    .min(1, 'At least one allowed extension is required')
    .refine(
      (list) => list.every((ext) => ext in KNOWN_FILE_TYPES),
      'Every allowed extension must exist in KNOWN_FILE_TYPES'
    ),
  maxFileSizeBytes: z.number().int().positive(),
  maxFileCount: z.number().int().positive(),
  maxFilenameLength: z.number().int().min(16).max(255).default(DEFAULT_MAX_FILENAME_LENGTH),
});

export type DocumentUploadConfig = z.infer<typeof documentUploadConfigSchema>;

export class DocumentConfigError extends Error {
  constructor(message: string, public readonly missing: string[] = []) {
    super(message);
    this.name = 'DocumentConfigError';
  }
}

/** Validate a config object (used by tests and by the env loader). */
export function parseDocumentUploadConfig(raw: unknown): DocumentUploadConfig {
  const result = documentUploadConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new DocumentConfigError(
      `Invalid document upload configuration: ${result.error.issues
        .map((i) => `${i.path.join('.') || 'config'}: ${i.message}`)
        .join('; ')}`
    );
  }
  return result.data;
}

export const DOCUMENT_ENV_KEYS = {
  allowedExtensions: 'DOCUMENT_ALLOWED_EXTENSIONS',
  maxFileSizeBytes: 'DOCUMENT_MAX_FILE_SIZE_BYTES',
  maxFileCount: 'DOCUMENT_MAX_FILE_COUNT',
} as const;

/**
 * Build the config from environment variables. Throws DocumentConfigError that
 * lists every missing variable, because the values are still undecided (CL-14).
 *
 *   DOCUMENT_ALLOWED_EXTENSIONS   comma-separated, e.g. "pdf,xlsx"
 *   DOCUMENT_MAX_FILE_SIZE_BYTES  positive integer
 *   DOCUMENT_MAX_FILE_COUNT       positive integer
 */
export function loadDocumentUploadConfig(
  env: NodeJS.ProcessEnv = process.env
): DocumentUploadConfig {
  const missing = Object.values(DOCUMENT_ENV_KEYS).filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new DocumentConfigError(
      `Missing document upload configuration: ${missing.join(', ')}`,
      missing
    );
  }

  return parseDocumentUploadConfig({
    allowedExtensions: env[DOCUMENT_ENV_KEYS.allowedExtensions]!
      .split(',')
      .map((e) => e.trim().replace(/^\./, ''))
      .filter(Boolean),
    maxFileSizeBytes: Number(env[DOCUMENT_ENV_KEYS.maxFileSizeBytes]),
    maxFileCount: Number(env[DOCUMENT_ENV_KEYS.maxFileCount]),
  });
}