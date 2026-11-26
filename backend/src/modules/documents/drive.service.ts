import { Readable } from 'node:stream';
import { google, drive_v3 } from 'googleapis';

/** Port used by the rest of the module, so Drive can be faked in tests. */
export interface DriveStorage {
  upload(input: {
    name: string;
    mimeType: string;
    body: Readable;
    contractFormId: string;
    contractFolderName: string;
  }): Promise<{ driveFileId: string }>;
  download(driveFileId: string): Promise<Readable>;
  remove(driveFileId: string): Promise<void>;
}

export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveError';
  }
}

function googleStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'status' in error.response &&
    typeof error.response.status === 'number'
  ) {
    return error.response.status;
  }
  return undefined;
}

function operationError(message: string, error: unknown): DriveError {
  const status = googleStatus(error);
  return new DriveError(status ? `${message} (Google Drive returned HTTP ${status})` : message);
}

export interface GoogleDriveOptions {
  /** Folder (or Shared Drive folder) that receives the files. Default: GOOGLE_DRIVE_FOLDER_ID. */
  folderId?: string;
  /** Service-account key file. Default: GOOGLE_APPLICATION_CREDENTIALS. */
  keyFile?: string;
  authMode?: 'oauth' | 'service-account';
  oauth?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
  };
  /** Inject a ready Drive client (used by tests). */
  drive?: drive_v3.Drive;
}

const ROOT_FOLDER_NAME = 'Contract Forms Automation';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

/**
 * Google Drive storage using OAuth or a service account. OAuth can create an
 * app-owned root folder under the narrow drive.file scope; service accounts
 * require a configured Shared Drive folder. Files are never made public.
 */
export function createGoogleDriveStorage(options: GoogleDriveOptions = {}): DriveStorage {
  const folderId =
    options.folderId ?? (process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || undefined);
  const oauth = options.oauth ?? {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  };
  const oauthConfigured = Boolean(
    oauth.clientId?.trim() && oauth.clientSecret?.trim() && oauth.refreshToken?.trim()
  );
  const authMode =
    options.authMode ??
    process.env.GOOGLE_DRIVE_AUTH_MODE ??
    (oauthConfigured ? 'oauth' : 'service-account');

  if (authMode !== 'oauth' && authMode !== 'service-account') {
    throw new DriveError('GOOGLE_DRIVE_AUTH_MODE must be oauth or service-account');
  }

  const oauthClientId = oauth.clientId?.trim();
  const oauthClientSecret = oauth.clientSecret?.trim();
  const oauthRefreshToken = oauth.refreshToken?.trim();
  let drive = options.drive;
  if (!drive && authMode === 'oauth') {
    if (!oauthClientId || !oauthClientSecret || !oauthRefreshToken) {
      throw new DriveError('Google Drive OAuth client ID, client secret, and refresh token are required');
    }
    const auth = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
    auth.setCredentials({ refresh_token: oauthRefreshToken });
    drive = google.drive({ version: 'v3', auth });
  } else if (!drive && authMode === 'service-account') {
    const keyFile = options.keyFile ?? process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (!keyFile) {
      throw new DriveError('GOOGLE_APPLICATION_CREDENTIALS is not configured');
    }
    drive = google.drive({
      version: 'v3',
      auth: new google.auth.GoogleAuth({
        keyFile,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      }),
    });
  }

  const driveClient = drive;
  if (!driveClient) {
    throw new DriveError('Google Drive client could not be initialized');
  }

  if (authMode === 'service-account' && !folderId) {
    throw new DriveError('GOOGLE_DRIVE_FOLDER_ID is required for service-account storage');
  }

  const contractFolders = new Map<string, Promise<{ id: string; name: string }>>();
  let rootFolderPromise: Promise<string> | undefined;

  const getRootFolderId = (): Promise<string> => {
    if (folderId) return Promise.resolve(folderId);
    if (authMode !== 'oauth') {
      return Promise.reject(new DriveError('GOOGLE_DRIVE_FOLDER_ID is not configured'));
    }
    if (rootFolderPromise) return rootFolderPromise;

    const pending = (async () => {
      const result = await driveClient.files.list({
        q: `name = '${ROOT_FOLDER_NAME}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`,
        fields: 'files(id)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const existingId = result.data.files?.[0]?.id;
      if (existingId) return existingId;

      const created = await driveClient.files.create({
        requestBody: {
          name: ROOT_FOLDER_NAME,
          mimeType: FOLDER_MIME_TYPE,
        },
        fields: 'id',
        supportsAllDrives: true,
      });
      if (!created.data.id) throw new Error('Drive returned no root folder id');
      return created.data.id;
    })();

    rootFolderPromise = pending;
    void pending.catch(() => {
      if (rootFolderPromise === pending) rootFolderPromise = undefined;
    });
    return pending;
  };

  const findOrCreateContractFolder = async (
    contractFormId: string,
    contractFolderName: string
  ): Promise<{ id: string; name: string }> => {
    const rootFolderId = await getRootFolderId();
    const baseQuery = `'${rootFolderId}' in parents and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`;
    const byContractProperty = await driveClient.files.list({
      q: `${baseQuery} and appProperties has { key='contractFormId' and value='${contractFormId}' }`,
      fields: 'files(id)',
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    let existingId = byContractProperty.data.files?.[0]?.id;

    if (!existingId) {
      const legacyName = contractFormId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const legacyFolder = await driveClient.files.list({
        q: `${baseQuery} and name = '${legacyName}'`,
        fields: 'files(id)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      existingId = legacyFolder.data.files?.[0]?.id;
    }

    if (existingId) {
      await driveClient.files.update({
        fileId: existingId,
        requestBody: {
          name: contractFolderName,
          appProperties: { contractFormId },
        },
        fields: 'id',
        supportsAllDrives: true,
      });
      return { id: existingId, name: contractFolderName };
    }

    const created = await driveClient.files.create({
      requestBody: {
        name: contractFolderName,
        mimeType: FOLDER_MIME_TYPE,
        parents: [rootFolderId],
        appProperties: { contractFormId },
      },
      fields: 'id',
      supportsAllDrives: true,
    });
    if (!created.data.id) throw new Error('Drive returned no contract folder id');
    return { id: created.data.id, name: contractFolderName };
  };

  const getContractFolderId = async (
    contractFormId: string,
    contractFolderName: string
  ): Promise<string> => {
    let pending = contractFolders.get(contractFormId);
    if (!pending) {
      pending = findOrCreateContractFolder(contractFormId, contractFolderName);
      contractFolders.set(contractFormId, pending);
      void pending.catch(() => {
        if (contractFolders.get(contractFormId) === pending) {
          contractFolders.delete(contractFormId);
        }
      });
    }

    const folder = await pending;
    if (folder.name !== contractFolderName) {
      await driveClient.files.update({
        fileId: folder.id,
        requestBody: {
          name: contractFolderName,
          appProperties: { contractFormId },
        },
        fields: 'id',
        supportsAllDrives: true,
      });
      contractFolders.set(contractFormId, Promise.resolve({ id: folder.id, name: contractFolderName }));
    }
    return folder.id;
  };

  return {
    async upload({ name, mimeType, body, contractFormId, contractFolderName }) {
      try {
        const contractFolderId = await getContractFolderId(contractFormId, contractFolderName);
        const res = await driveClient.files.create({
          requestBody: { name, parents: [contractFolderId] },
          media: { mimeType, body },
          fields: 'id',
          supportsAllDrives: true,
        });
        if (!res.data.id) throw new Error('Drive returned no file id');
        return { driveFileId: res.data.id };
      } catch (error) {
        throw operationError('Failed to upload file to Google Drive', error);
      }
    },

    async download(driveFileId) {
      try {
        const res = await driveClient.files.get(
          { fileId: driveFileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream' }
        );
        return res.data as unknown as Readable;
      } catch (error) {
        throw operationError('Failed to download file from Google Drive', error);
      }
    },

    async remove(driveFileId) {
      try {
        await driveClient.files.delete({ fileId: driveFileId, supportsAllDrives: true });
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          typeof error.response === 'object' &&
          error.response !== null &&
          'status' in error.response &&
          typeof error.response.status === 'number' &&
          error.response.status === 404
        ) {
          return;
        }
        throw operationError('Failed to delete file from Google Drive', error);
      }
    },
  };
}
