import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  sanitizeFilename,
  resolveDuplicateFilename,
  createStorageFilename,
  reserveUniqueFilePath,
  buildContractDriveFolderName,
  InvalidFilenameError,
} from './file.utils';

describe('sanitizeFilename', () => {
  it('keeps a normal name and lower-cases the extension', () => {
    expect(sanitizeFilename('Quote.PDF')).toBe('Quote.pdf');
  });
  it('replaces spaces and unsafe characters', () => {
    expect(sanitizeFilename('my  quote <final>?.pdf')).toBe('my_quote_final.pdf');
  });
  it.each([
    ['../../etc/passwd', 'passwd'],
    ['..\\..\\windows\\evil.pdf', 'evil.pdf'],
    ['/var/www/shell.pdf', 'shell.pdf'],
    ['C:\\temp\\a.xlsx', 'a.xlsx'],
    ['folder/sub/report.pdf', 'report.pdf'],
  ])('removes directories / traversal: %s', (input, expected) => {
    expect(sanitizeFilename(input)).toBe(expected);
  });
  it('removes null bytes, control, zero-width and bidi characters', () => {
    expect(sanitizeFilename('qu\u0000ote\u202E.pdf')).toBe('quote.pdf');
    expect(sanitizeFilename('a\u200Bb.pdf')).toBe('ab.pdf');
  });
  it('neutralises double extensions', () => {
    expect(sanitizeFilename('invoice.exe.pdf')).toBe('invoice_exe.pdf');
  });
  it('prefixes Windows reserved names', () => {
    expect(sanitizeFilename('CON.pdf')).toBe('_CON.pdf');
    expect(sanitizeFilename('lpt1.xlsx')).toBe('_lpt1.xlsx');
  });
  it('strips leading dots (hidden files)', () => {
    expect(sanitizeFilename('...hidden.pdf')).toBe('hidden.pdf');
  });
  it('keeps letters of other languages', () => {
    expect(sanitizeFilename('عرض سعر.pdf')).toBe('عرض_سعر.pdf');
    expect(sanitizeFilename('अनुबंध प्रपत्र.pdf')).toBe('अनुबंध_प्रपत्र.pdf');
  });
  it('preserves the extension when truncating long names', () => {
    const result = sanitizeFilename('a'.repeat(400) + '.pdf');
    expect(result.endsWith('.pdf')).toBe(true);
    expect(Buffer.byteLength(result)).toBeLessThanOrEqual(180);
  });
  it('truncates by bytes for multi-byte characters', () => {
    const result = sanitizeFilename('é'.repeat(300) + '.pdf');
    expect(Buffer.byteLength(result)).toBeLessThanOrEqual(180);
    expect(result.endsWith('.pdf')).toBe(true);
  });
  it('throws for empty, blank and non-string input', () => {
    expect(() => sanitizeFilename('')).toThrow(InvalidFilenameError);
    expect(() => sanitizeFilename('   ')).toThrow(InvalidFilenameError);
    expect(() => sanitizeFilename(undefined as unknown as string)).toThrow(InvalidFilenameError);
  });
  it('falls back to "file" when nothing usable is left', () => {
    expect(sanitizeFilename('%%%.pdf')).toBe('file.pdf');
    expect(sanitizeFilename('.....')).toBe('file');
    expect(sanitizeFilename('..')).toBe('file');
  });
  it('handles names without an extension', () => {
    expect(sanitizeFilename('README')).toBe('README');
  });
  it('rejects an invalid maxBytes', () => {
    expect(() => sanitizeFilename('a.pdf', 5)).toThrow(RangeError);
  });
});

describe('resolveDuplicateFilename', () => {
  it('returns the name unchanged when it is free', () => {
    expect(resolveDuplicateFilename('a.pdf', ['b.pdf'])).toBe('a.pdf');
  });
  it('adds an incrementing suffix before the extension', () => {
    expect(resolveDuplicateFilename('a.pdf', ['a.pdf'])).toBe('a_1.pdf');
    expect(resolveDuplicateFilename('a.pdf', ['a.pdf', 'a_1.pdf'])).toBe('a_2.pdf');
  });
  it('compares case-insensitively', () => {
    expect(resolveDuplicateFilename('A.pdf', ['a.PDF'])).toBe('A_1.pdf');
  });
  it('keeps long names within the byte limit', () => {
    const long = 'a'.repeat(176) + '.pdf';
    const result = resolveDuplicateFilename(long, [long]);
    expect(Buffer.byteLength(result)).toBeLessThanOrEqual(180);
    expect(result.endsWith('_1.pdf')).toBe(true);
  });
});

describe('createStorageFilename', () => {
  it('creates unique names that keep only the extension', () => {
    const a = createStorageFilename('Quote.pdf');
    const b = createStorageFilename('Quote.pdf');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(createStorageFilename('README')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('reserveUniqueFilePath', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-test-'));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('never overwrites an existing file', async () => {
    await fs.writeFile(path.join(dir, 'a.pdf'), 'original');
    const reserved = await reserveUniqueFilePath(dir, 'a.pdf');
    expect(path.basename(reserved)).toBe('a_1.pdf');
    expect(await fs.readFile(path.join(dir, 'a.pdf'), 'utf8')).toBe('original');
  });
  it('gives concurrent uploads different paths', async () => {
    const paths = await Promise.all(
      Array.from({ length: 5 }, () => reserveUniqueFilePath(dir, 'same.pdf'))
    );
    expect(new Set(paths).size).toBe(5);
  });
  it('keeps traversal attempts inside the directory', async () => {
    const reserved = await reserveUniqueFilePath(dir, '../../escape.pdf');
    expect(path.dirname(reserved)).toBe(path.resolve(dir));
    expect(path.basename(reserved)).toBe('escape.pdf');
  });
  it('creates the directory when missing', async () => {
    const nested = path.join(dir, 'nested', 'tmp');
    const reserved = await reserveUniqueFilePath(nested, 'a.pdf');
    expect(path.dirname(reserved)).toBe(path.resolve(nested));
  });
});

describe('buildContractDriveFolderName', () => {
  it('uses only the reference number when one is available', () => {
    expect(buildContractDriveFolderName(
      '12345678-1234-4234-8234-123456789abc',
      'Office Renovation',
      'CTR-2026-0001'
    )).toBe('CTR-2026-0001');
  });

  it('uses a readable title and stable short id before a reference exists', () => {
    expect(buildContractDriveFolderName(
      '12345678-1234-4234-8234-123456789abc',
      'Office Renovation',
      null
    )).toBe('Office Renovation - 12345678');
  });

  it('removes unsafe separators and bounds long folder names', () => {
    const name = buildContractDriveFolderName(
      '12345678-1234-4234-8234-123456789abc',
      `${'A'.repeat(220)}\\Renovation`,
      null
    );

    expect(name).toContain('A'.repeat(10));
    expect(name).not.toContain('\\');
    expect(name.length).toBeLessThanOrEqual(180);
    expect(name.endsWith('12345678')).toBe(true);
  });
});
