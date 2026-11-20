import { Readable } from 'node:stream';
import { downloadFromGoogleDrive, removeFromGoogleDrive, uploadToGoogleDrive } from '../lib/google-drive';

export interface DriveStorage {
  upload(input: { name: string; mimeType: string; body: Readable }): Promise<{ driveFileId: string }>;
  download(id: string): Promise<Readable>;
  remove(id: string): Promise<void>;
}

export const googleDriveStorage: DriveStorage = {
  upload: uploadToGoogleDrive,
  download: downloadFromGoogleDrive,
  remove: removeFromGoogleDrive,
};
