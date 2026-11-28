# Google Drive Integration

## Status

Google Drive integration is **implemented, configured, and verified** in the deployed application. The backend successfully connects to Google Drive and handles document uploads and storage using the configured credentials and permissions.

## Implemented Behavior

The backend uploads supporting documents and generated PDFs through the Google Drive API. PostgreSQL stores attachment metadata, including the private Drive file ID. API responses replace private Drive IDs with attachment UUIDs and public metadata.

## Authentication Modes

### OAuth

Requires `GOOGLE_DRIVE_AUTH_MODE=oauth` and:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

Optional `GOOGLE_DRIVE_FOLDER_ID` can point to an approved folder. With the app-owned OAuth scope, leaving the folder blank can create an app-owned root folder.

### Service Account

Requires:

- `GOOGLE_DRIVE_AUTH_MODE=service-account`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_DRIVE_FOLDER_ID`

The service-account key must remain outside source control and be readable by the backend runtime.

## Upload Policy

Set `DOCUMENT_ALLOWED_EXTENSIONS`, `DOCUMENT_MAX_FILE_SIZE_BYTES`, and `DOCUMENT_MAX_FILE_COUNT`.

The example policy is 10 MiB per file and five files per request. These values represent the configured example policy and should be adjusted if the project's actual limits differ.

## Folder and Naming Behavior

The implementation adds a configured Drive parent folder when present. Contract folders are named using the contract ID, title, and reference number. Individual files use the upload/display names supplied to the document service.

## Failure Behavior

- Missing upload policy fails closed with HTTP 503.
- Missing or invalid credentials are not replaced by Azure or local blob storage.
- Download and view errors are handled by the backend document service.
- Showcase seeding skips PDF attachment creation if Drive is unavailable or upload is disabled.

## Setup

1. Configure OAuth or service-account credentials.
2. Store credentials securely outside source control.
3. Configure backend environment variables or Azure App Service settings.
4. Set the required private parent folder ID, where applicable.
5. Upload a test contract/document.
6. Verify that the file appears in the configured Google Drive location.
7. Test view/download permissions using submitter, approver, and admin accounts.

## Security

- Never commit OAuth secrets or service-account JSON files.
- Never place Google credentials in frontend `NEXT_PUBLIC_*` variables.
- Use least-privilege folder and file permissions.
- Do not enable public or anonymous Drive sharing.
- Rotate credentials immediately if they are exposed.
