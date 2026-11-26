import { google, drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';

let client: drive_v3.Drive | undefined;
function getDrive(): drive_v3.Drive {
  if (!client) {
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!keyFile) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not configured');
    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    client = google.drive({ version: 'v3', auth });
  }
  return client;
}

export async function uploadToGoogleDrive(input: {
  name: string; mimeType: string; body: Readable;
}): Promise<{ driveFileId: string }> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const result = await getDrive().files.create({
    requestBody: { name: input.name, ...(folderId ? { parents: [folderId] } : {}) },
    media: { mimeType: input.mimeType, body: input.body },
    fields: 'id',
  });
  if (!result.data.id) throw new Error('Google Drive did not return a file ID');
  return { driveFileId: result.data.id };
}

export async function downloadFromGoogleDrive(id: string): Promise<Readable> {
  const result = await getDrive().files.get({ fileId: id, alt: 'media' }, { responseType: 'stream' });
  return result.data as Readable;
}

export async function removeFromGoogleDrive(id: string): Promise<void> {
  await getDrive().files.delete({ fileId: id });
}
