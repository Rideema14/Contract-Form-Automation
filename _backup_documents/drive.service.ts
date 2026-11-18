import { Readable } from 'node:stream';
import { google, drive_v3 } from 'googleapis';

/** Port used by the rest of the module, so Drive can be faked in tests. */
export interface DriveStorage {
  upload(input: {
    name: string;
    mimeType: string;
    body: Readable;
  }): Promise<{ driveFileId: string }>;
  download(driveFileId: string): Promise<Readable>;
  remove(driveFileId: string): Promise<void>;
}

export class DriveError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DriveError';
  }
}

export interface GoogleDriveOptions {
  /** Folder (or Shared Drive folder) that receives the files. Default: GOOGLE_DRIVE_FOLDER_ID. */
  folderId?: string;
  /** Service-account key file. Default: GOOGLE_APPLICATION_CREDENTIALS. */
  keyFile?: string;
  /** Inject a ready Drive client (used by tests). */
  drive?: drive_v3.Drive;
}

/**
 * Google Drive storage using a service account. Files are created inside the
 * configured folder and NO sharing permission is ever added, so they stay
 * private to the service account / Shared Drive members. Every download goes
 * through the backend. Decision still open: Shared Drive vs OAuth (the code
 * uses supportsAllDrives so a Shared Drive folder works).
 */
export function createGoogleDriveStorage(options: GoogleDriveOptions = {}): DriveStorage {
  const folderId = options.folderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new DriveError('GOOGLE_DRIVE_FOLDER_ID is not configured');

  const drive =
    options.drive ??
    google.drive({
      version: 'v3',
      auth: new google.auth.GoogleAuth({
        keyFile: options.keyFile ?? process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      }),
    });

  return {
    async upload({ name, mimeType, body }) {
      try {
        const res = await drive.files.create({
          requestBody: { name, parents: [folderId] },
          media: { mimeType, body },
          fields: 'id',
          supportsAllDrives: true,
        });
        if (!res.data.id) throw new Error('Drive returned no file id');
        return { driveFileId: res.data.id };
      } catch (error) {
        throw new DriveError('Failed to upload file to Google Drive', error);
      }
    },

    async download(driveFileId) {
      try {
        const res = await drive.files.get(
          { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream' }
        );
        return res.data as unknown as Readable;
      } catch (error) {
        throw new DriveError('Failed to download file from Google Drive', error);
      }
    },

    async remove(driveFileId) {
      try {
        await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
      } catch (error) {
        throw new DriveError('Failed to delete file from Google Drive', error);
      }
    },
  };
}
