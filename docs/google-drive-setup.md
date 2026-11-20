# Google Drive setup

Google Drive is an external service used **only by the backend**.

## Flow
Upload: browser -> Express upload endpoint -> authenticate and authorize -> validate size/type/content
-> upload to private Google Drive -> save Drive File ID + metadata in PostgreSQL -> return safe metadata.

Download: backend checks access again. A Drive File ID alone is not authorization.

## Setup steps
1. Create a Google Cloud project and enable the Google Drive API.
2. For personal My Drive, create an OAuth client and authorize it with the `drive.file` scope and offline access using the approved Google OAuth consent flow. Configure the client ID, client secret, and refresh token only in `backend/.env` or the deployment secret store.
3. Leave `GOOGLE_DRIVE_FOLDER_ID` empty to have the OAuth app create its own root folder. An existing folder can be configured only if it was created by or explicitly selected for this OAuth app.
4. For Workspace Shared Drive instead, create a service account, save its JSON key under gitignored `backend/secrets/`, share the Shared Drive folder with that account, set `GOOGLE_DRIVE_AUTH_MODE=service-account`, and configure `GOOGLE_APPLICATION_CREDENTIALS` and `GOOGLE_DRIVE_FOLDER_ID`.
5. Use a test contract first. Upload a test attachment, verify it appears in that contract's subfolder, download it through the application, and confirm it is not publicly shared. Remove test data using an approved cleanup procedure.

The backend creates/reuses one child folder per contract under the app-owned/configured root. It does not create public permissions. Files are downloaded through authorized backend routes; the Drive ID is never returned to the browser.

## Rules
- A public API key is not sufficient for private uploads. Never set files to "Anyone with the link".
- Never put credentials in the frontend or in `NEXT_PUBLIC_` variables.
- Metadata stored per file: Drive File ID, original filename, MIME type, category, uploader, upload date, related contract ID.
- Drive upload and the database save are not one transaction: log failures and provide retry/cleanup for orphaned files.
- Keep OAuth secrets, `backend/secrets/`, and `backend/.env` out of source control. The repository ignores both.
- The approved file policy is in `backend/.env.example`: 10 MiB per file, up to 5 files per request, and the agreed extension list. Contract records and documents are retained for the contract lifetime; audit logs for at least 7 years. No automatic deletion is permitted.
- The selected account model is personal My Drive with OAuth and `drive.file`; the app-created root folder avoids granting access to the user's entire Drive.
- Implementation: `backend/src/modules/documents/drive.service.ts`, `backend/src/modules/documents/documents.runtime.ts`, and `backend/src/modules/documents/attachments.router.ts`.
