# Google Drive setup

Google Drive is an external service used **only by the backend**.

## Flow
Upload: browser -> Express upload endpoint -> authenticate and authorize -> validate size/type/content
-> upload to private Google Drive -> save Drive File ID + metadata in PostgreSQL -> return safe metadata.

Download: backend checks access again. A Drive File ID alone is not authorization.

## Setup steps
1. Create a Google Cloud project and enable the Google Drive API.
2. Create a service account and download its JSON key.
3. Save the key as `backend/secrets/google-service-account.json` (gitignored - never commit it).
4. Share the target Shared Drive / folder with the service account. A service account cannot own files in an individual's personal My Drive; use a Workspace Shared Drive or OAuth on behalf of a user.
5. Put the folder ID in `backend/.env` as `GOOGLE_DRIVE_FOLDER_ID` and keep `GOOGLE_APPLICATION_CREDENTIALS="./secrets/google-service-account.json"`.

## Rules
- A public API key is not sufficient for private uploads. Never set files to "Anyone with the link".
- Never put credentials in the frontend or in `NEXT_PUBLIC_` variables.
- Metadata stored per file: Drive File ID, original filename, MIME type, category, uploader, upload date, related contract ID.
- Drive upload and the database save are not one transaction: log failures and provide retry/cleanup for orphaned files.
- Files: `backend/src/services/google-drive.service.ts`, `backend/src/lib/google-drive.ts`, `backend/src/middleware/upload.ts`.
