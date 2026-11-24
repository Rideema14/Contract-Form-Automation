import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { drive_v3 } from 'googleapis';
import { createGoogleDriveStorage, DriveError } from './drive.service';

function fakeDrive(overrides: Record<string, unknown> = {}) {
  const files = {
    list: vi.fn().mockResolvedValue({ data: { files: [] } }),
    create: vi.fn().mockResolvedValue({ data: { id: 'drive-1' } }),
    update: vi.fn().mockResolvedValue({ data: { id: 'drive-1' } }),
    get: vi.fn().mockResolvedValue({ data: Readable.from(['hello']) }),
    delete: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
  return { drive: { files } as unknown as drive_v3.Drive, files };
}

describe('createGoogleDriveStorage', () => {
  it('requires explicit OAuth credentials instead of silently falling back to ambient identity', () => {
    expect(() => createGoogleDriveStorage({
      authMode: 'oauth',
      oauth: {},
    })).toThrow(DriveError);
  });

  it('requires a folder id', () => {
    const saved = process.env.GOOGLE_DRIVE_FOLDER_ID;
    delete process.env.GOOGLE_DRIVE_FOLDER_ID;
    try {
      expect(() => createGoogleDriveStorage({
        drive: fakeDrive().drive,
        authMode: 'service-account',
      })).toThrow(DriveError);
    } finally {
      if (saved) process.env.GOOGLE_DRIVE_FOLDER_ID = saved;
    }
  });

  it('creates a private folder per contract and uploads into it', async () => {
    const { drive, files } = fakeDrive();
    const storage = createGoogleDriveStorage({
      drive,
      folderId: 'folder-1',
      authMode: 'service-account',
    });
    const result = await storage.upload({
      name: 'a.pdf',
      mimeType: 'application/pdf',
      body: Readable.from(['x']),
      contractFormId: 'form-1',
      contractFolderName: 'CF-1 - Renovation - form1',
    });
    expect(result).toEqual({ driveFileId: 'drive-1' });
    expect(files.list).toHaveBeenCalledWith(expect.objectContaining({
      q: expect.stringContaining("'folder-1' in parents"),
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }));
    expect(files.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      requestBody: {
        name: 'CF-1 - Renovation - form1',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['folder-1'],
        appProperties: { contractFormId: 'form-1' },
      },
      supportsAllDrives: true,
    }));
    expect(files.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      requestBody: { name: 'a.pdf', parents: ['drive-1'] },
      supportsAllDrives: true,
    }));
  });

  it('reuses an existing per-contract folder', async () => {
    const { drive, files } = fakeDrive({
      list: vi.fn().mockResolvedValue({ data: { files: [{ id: 'contract-folder' }] } }),
    });
    const storage = createGoogleDriveStorage({
      drive,
      folderId: 'root-folder',
      authMode: 'service-account',
    });
    await storage.upload({
      name: 'a.pdf',
      mimeType: 'application/pdf',
      body: Readable.from(['x']),
      contractFormId: 'form-1',
      contractFolderName: 'CF-1 - Renovation - form1',
    });
    expect(files.create).toHaveBeenCalledOnce();
    expect(files.create.mock.calls[0][0].requestBody).toEqual({
      name: 'a.pdf',
      parents: ['contract-folder'],
    });
    expect(files.update).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'contract-folder',
      requestBody: {
        name: 'CF-1 - Renovation - form1',
        appProperties: { contractFormId: 'form-1' },
      },
    }));
  });

  it('renames a legacy UUID-named folder without creating a duplicate', async () => {
    const { drive, files } = fakeDrive({
      list: vi.fn()
        .mockResolvedValueOnce({ data: { files: [] } })
        .mockResolvedValueOnce({ data: { files: [{ id: 'legacy-folder' }] } }),
    });
    const storage = createGoogleDriveStorage({
      drive,
      folderId: 'root-folder',
      authMode: 'service-account',
    });

    await storage.upload({
      name: 'a.pdf',
      mimeType: 'application/pdf',
      body: Readable.from(['x']),
      contractFormId: 'form-1',
      contractFolderName: 'CF-1 - Renovation - form1',
    });

    expect(files.create).toHaveBeenCalledOnce();
    expect(files.update).toHaveBeenCalledWith(expect.objectContaining({
      fileId: 'legacy-folder',
      requestBody: {
        name: 'CF-1 - Renovation - form1',
        appProperties: { contractFormId: 'form-1' },
      },
    }));
  });

  it('creates an app-owned root for OAuth when no existing folder is configured', async () => {
    const { drive, files } = fakeDrive({
      create: vi.fn()
        .mockResolvedValueOnce({ data: { id: 'app-root' } })
        .mockResolvedValueOnce({ data: { id: 'contract-folder' } })
        .mockResolvedValueOnce({ data: { id: 'file-1' } }),
    });
    const storage = createGoogleDriveStorage({ drive, authMode: 'oauth' });

    await storage.upload({
      name: 'a.pdf',
      mimeType: 'application/pdf',
      body: Readable.from(['x']),
      contractFormId: 'form-1',
      contractFolderName: 'CF-1 - Renovation - form1',
    });

    expect(files.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      requestBody: {
        name: 'Contract Forms Automation',
        mimeType: 'application/vnd.google-apps.folder',
      },
    }));
    expect(files.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      requestBody: {
        name: 'CF-1 - Renovation - form1',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['app-root'],
        appProperties: { contractFormId: 'form-1' },
      },
    }));
    expect(files.create).toHaveBeenNthCalledWith(3, expect.objectContaining({
      requestBody: { name: 'a.pdf', parents: ['contract-folder'] },
    }));
  });

  it('shares an in-flight folder lookup for concurrent uploads to the same contract', async () => {
    const { drive, files } = fakeDrive();
    const storage = createGoogleDriveStorage({
      drive,
      folderId: 'root-folder',
      authMode: 'service-account',
    });
    const upload = (name: string) => storage.upload({
      name,
      mimeType: 'application/pdf',
      body: Readable.from(['x']),
      contractFormId: 'form-1',
      contractFolderName: 'CF-1 - Renovation - form1',
    });

    await Promise.all([upload('a.pdf'), upload('b.pdf')]);

    expect(files.list).toHaveBeenCalledTimes(2);
    expect(files.create).toHaveBeenCalledTimes(3);
  });

  it('downloads as a stream and deletes', async () => {
    const { drive, files } = fakeDrive();
    const storage = createGoogleDriveStorage({ drive, folderId: 'f', authMode: 'service-account' });
    const stream = await storage.download('drive-1');
    expect(stream).toBeInstanceOf(Readable);
    expect(files.get.mock.calls[0][0]).toMatchObject({ fileId: 'drive-1', alt: 'media' });
    await storage.remove('drive-1');
    expect(files.delete).toHaveBeenCalledWith({ fileId: 'drive-1', supportsAllDrives: true });
  });

  it('treats a missing Drive file as already deleted so Admin retries are safe', async () => {
    const { drive } = fakeDrive({
      delete: vi.fn().mockRejectedValue({ response: { status: 404 } }),
    });
    const storage = createGoogleDriveStorage({
      drive,
      folderId: 'folder-1',
      authMode: 'service-account',
    });

    await expect(storage.remove('already-removed')).resolves.toBeUndefined();
  });

  it('wraps Drive failures in DriveError', async () => {
    const { drive } = fakeDrive({ create: vi.fn().mockRejectedValue(new Error('boom')) });
    const storage = createGoogleDriveStorage({ drive, folderId: 'f', authMode: 'service-account' });
    await expect(
      storage.upload({
        name: 'a.pdf',
        mimeType: 'application/pdf',
        body: Readable.from(['x']),
        contractFormId: 'form-1',
        contractFolderName: 'CF-1 - Renovation - form1',
      })
    ).rejects.toBeInstanceOf(DriveError);
  });

  it('reports the Drive HTTP status without including provider error details', async () => {
    const { drive } = fakeDrive({
      create: vi.fn().mockRejectedValue({
        response: { status: 403, data: { error: 'private credential marker' } },
      }),
    });
    const storage = createGoogleDriveStorage({ drive, folderId: 'f', authMode: 'service-account' });

    await expect(
      storage.upload({
        name: 'a.pdf',
        mimeType: 'application/pdf',
        body: Readable.from(['x']),
        contractFormId: 'form-1',
        contractFolderName: 'CF-1 - Renovation - form1',
      })
    ).rejects.toMatchObject({
      name: 'DriveError',
      message: 'Failed to upload file to Google Drive (Google Drive returned HTTP 403)',
    });
  });
});
