# Google Drive Integration

## Status

Google Drive integration is implemented in the backend, but live connectivity is configuration-dependent. **Needs verification** for OAuth consent, Shared Drive access, folder ACL, and production credentials.

## Implemented behavior

The backend uploads supporting documents and generated PDFs through the Google Drive API. PostgreSQL stores attachment metadata, including the private Drive file ID. API responses replace private Drive IDs with attachment UUIDs and public metadata.

## Authentication modes

### OAuth

Requires `GOOGLE_DRIVE_AUTH_MODE=oauth` and:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`

Optional `GOOGLE_DRIVE_FOLDER_ID` can point to an approved folder. The repository example states that with the app-owned OAuth scope, leaving the folder blank can create an app-owned root folder.

### Service account

Requires:

- `GOOGLE_DRIVE_AUTH_MODE=service-account`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `GOOGLE_DRIVE_FOLDER_ID`

The service-account key must remain outside source control and be readable by the backend runtime.

## Upload policy

Set `DOCUMENT_ALLOWED_EXTENSIONS`, `DOCUMENT_MAX_FILE_SIZE_BYTES`, and `DOCUMENT_MAX_FILE_COUNT`.

The example policy is 10 MiB per file and five files per request. It is an example, not confirmed business policy.

## Folder and naming behavior

The implementation adds a configured Drive parent folder when present. Contract folders are named from contract ID, title, and reference number. Individual files use the upload/display names supplied to the document service.

## Failure behavior

- Missing upload policy fails closed with HTTP 503.
- Missing or invalid credentials are not replaced with Azure/local blob fallback.
- Download/view errors are handled by the backend document service.
- Showcase seeding skips PDF attachment creation if Drive is unavailable or upload is disabled.

## Setup

1. Obtain approval for OAuth or a shared-folder/service identity.
2. Create credentials outside source control.
3. Configure backend environment variables or Azure App Service settings.
4. Set a private parent folder ID where required.
5. Run a disposable contract upload.
6. Confirm the file appears only in the approved location.
7. Test view/download authorization with submitter, approver, and admin accounts.

## Security

- Never commit OAuth secrets or service-account JSON.
- Never place Google credentials in frontend `NEXT_PUBLIC_*` variables.
- Use least-privilege folder/file ACLs.
- Do not enable public/anonymous Drive sharing.
- Rotate a key or refresh token if exposed.
