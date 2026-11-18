import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { drive_v3 } from 'googleapis';
import { createGoogleDriveStorage, DriveError } from './drive.service';

function fakeDrive(overrides: Record<string, unknown> = {}) {
  const files = {
    create: vi.fn().mockResolvedValue({ data: { id: 'drive-1' } }),
    get: vi.fn().mockResolvedValue({ data: Readable.from(['hello']) }),
    delete: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  return { drive: { files } as unknown as drive_v3.Drive, files };
}

describe('createGoogleDriveStorage', () => {
  it('requires a folder id', () => {
    const saved = process.env.GOOGLE_DRIVE_FOLDER_ID;
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    try {
      expect(() => createGoogleDriveStorage({ drive: fakeDrive().drive })).toThrow(DriveError);
    } finally {
      if (saved) process.env.GOOGLE_DRIVE_FOLDER_ID = saved;
    }
  });

  it('uploads into the folder without adding permissions', async () => {
    const { drive, files } = fakeDrive();
    const storage = createGoogleDriveStorage({ drive, folderId: 'folder-1' });
    const result = await storage.upload({ name: 'a.pdf', mimeType: 'application/pdf', body: Readable.from(['x']) });
    expect(result).toEqual({ driveFileId: 'drive-1' });
    const arg = files.create.mock.calls[0][0];
    expect(arg.requestBody).toEqual({ name: 'a.pdf', parents: ['folder-1'] });
    expect(arg.supportsAllDrives).toBe(true);
  });

  it('downloads as a stream and deletes', async () => {
    const { drive, files } = fakeDrive();
    const storage = createGoogleDriveStorage({ drive, folderId: 'f' });
    const stream = await storage.download('drive-1');
    expect(stream).toBeInstanceOf(Readable);
    expect(files.get.mock.calls[0][0]).toMatchObject({ fileId: 'drive-1', alt: 'media' });
    await storage.remove('drive-1');
    expect(files.delete).toHaveBeenCalledWith({ fileId: 'drive-1', supportsAllDrives: true });
  });

  it('wraps Drive failures in DriveError', async () => {
    const { drive } = fakeDrive({ create: vi.fn().mockRejectedValue(new Error('boom')) });
    const storage = createGoogleDriveStorage({ drive, folderId: 'f' });
    await expect(
      storage.upload({ name: 'a.pdf', mimeType: 'application/pdf', body: Readable.from(['x']) })
    ).rejects.toBeInstanceOf(DriveError);
  });
});
