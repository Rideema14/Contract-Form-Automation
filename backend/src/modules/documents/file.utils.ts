import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getExtension } from './file.validator';

/** Maximum sanitised filename length in UTF-8 bytes (extension included). */
export const DEFAULT_MAX_SANITIZED_BYTES = 180;

const FALLBACK_BASENAME = 'file';
const MAX_EXTENSION_LENGTH = 10;
const MAX_DUPLICATE_ATTEMPTS = 10_000;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export class InvalidFilenameError extends Error {
  constructor(message = 'Invalid filename') {
    super(message);
    this.name = 'InvalidFilenameError';
  }
}

function truncateToBytes(value: string, maxBytes: number): string {
  let out = '';
  let bytes = 0;
  for (const ch of value) {
    const size = Buffer.byteLength(ch);
    if (bytes + size > maxBytes) break;
    out += ch;
    bytes += size;
  }
  return out;
}

/** Splits "name.ext" into parts. Only a short alphanumeric extension counts. */
function splitFilename(filename: string): { base: string; ext: string } {
  const ext = getExtension(filename);
  if (ext && /^[a-z0-9]+$/.test(ext) && ext.length <= MAX_EXTENSION_LENGTH) {
    return { base: filename.slice(0, -(ext.length + 1)), ext };
  }
  return { base: filename, ext: '' };
}

/**
 * Turns an untrusted upload name into a safe filename.
 *
 * - Removes any directory part (path traversal, both "/" and "\").
 * - Removes control, zero-width and bidi-override characters.
 * - Keeps letters/numbers of any language, replaces everything else with "_".
 * - Dots inside the name become "_" so "invoice.exe.pdf" cannot hide a
 *   double extension; only the final extension is kept (lower-cased).
 * - Prefixes Windows reserved device names (CON, NUL, ...).
 * - Truncates the NAME, never the extension, to maxBytes (UTF-8).
 *
 * Throws InvalidFilenameError for non-string or blank input. If the name
 * sanitises to nothing (for example "%%%.pdf"), the fallback "file" is used.
 */
export function sanitizeFilename(
  originalName: string,
  maxBytes: number = DEFAULT_MAX_SANITIZED_BYTES
): string {
  if (typeof originalName !== 'string' || originalName.trim() === '') {
    throw new InvalidFilenameError();
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 16 || maxBytes > 255) {
    throw new RangeError('maxBytes must be an integer between 16 and 255');
  }

  const leaf = path.posix.basename(originalName.replace(/\\/g, '/'));
  const cleaned = leaf
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .trim();

  const { base, ext } = splitFilename(cleaned);

  let safeBase = base
    .replace(/[^\p{L}\p{M}\p{N} _-]/gu, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');

  if (safeBase === '') safeBase = FALLBACK_BASENAME;
  if (WINDOWS_RESERVED.test(safeBase)) safeBase = `_${safeBase}`;

  const extPart = ext ? `.${ext}` : '';
  safeBase = truncateToBytes(safeBase, maxBytes - Buffer.byteLength(extPart))
    .replace(/[_-]+$/g, '');
  if (safeBase === '') safeBase = FALLBACK_BASENAME;

  return `${safeBase}${extPart}`;
}

/** "report.pdf" + 2 -> "report_2.pdf", keeping the result within maxBytes. */
function withSuffix(filename: string, n: number, maxBytes: number): string {
  const { base, ext } = splitFilename(filename);
  const suffix = `_${n}`;
  const extPart = ext ? `.${ext}` : '';
  const budget = maxBytes - Buffer.byteLength(suffix) - Buffer.byteLength(extPart);
  return `${truncateToBytes(base, budget)}${suffix}${extPart}`;
}

/**
 * Returns a name that is not in `existingNames` (compared case-insensitively,
 * because Windows and Google Drive treat "A.pdf" and "a.pdf" alike).
 * Intended for display names within one contract; the caller supplies the
 * existing names (for example from the database later).
 */


export function resolveDuplicateFilename(
  filename: string,
  existingNames: Iterable<string>,
  maxBytes: number = DEFAULT_MAX_SANITIZED_BYTES
): string {
  const safeFilename = sanitizeFilename(filename, maxBytes);

  const taken = new Set(
    Array.from(existingNames, (name) => name.toLowerCase())
  );

  if (!taken.has(safeFilename.toLowerCase())) {
    return safeFilename;
  }

  for (let n = 1; n <= MAX_DUPLICATE_ATTEMPTS; n++) {
    const candidate = withSuffix(safeFilename, n, maxBytes);

    if (!taken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  throw new InvalidFilenameError('Unable to generate a unique filename');
}



/**
 * Collision-proof name for storing a file on disk: a random UUID plus the
 * (already sanitised) extension. The original name is kept only as metadata.
 */
export function createStorageFilename(safeFilename: string): string {
  const { ext } = splitFilename(safeFilename);
  return `${randomUUID()}${ext ? `.${ext}` : ''}`;
}

/**
 * Atomically creates an empty file in `directory` using a sanitised version
 * of `filename`, adding _1, _2, ... if the name already exists. Uses the "wx"
 * flag, so an existing file can never be overwritten, even under concurrent
 * uploads. Returns the full path of the reserved file.
 */
export async function reserveUniqueFilePath(
  directory: string,
  filename: string,
  maxBytes: number = DEFAULT_MAX_SANITIZED_BYTES
): Promise<string> {
  const dir = path.resolve(directory);
  await fs.mkdir(dir, { recursive: true });
  const safe = sanitizeFilename(filename, maxBytes);

  for (let n = 0; n <= MAX_DUPLICATE_ATTEMPTS; n++) {
    const name = n === 0 ? safe : withSuffix(safe, n, maxBytes);
    const fullPath = path.join(dir, name);
    if (path.dirname(fullPath) !== dir) {
      throw new InvalidFilenameError('Resolved path escapes the target directory');
    }
    try {
      const handle = await fs.open(fullPath, 'wx');
      await handle.close();
      return fullPath;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw error;
    }
  }
  throw new InvalidFilenameError('Unable to generate a unique filename');
}