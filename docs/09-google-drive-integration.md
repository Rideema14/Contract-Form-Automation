# 09. Google Drive Integration

> **Implementation status:** Backend integration and authorized attachment routes are implemented. A real Google Drive account/folder has not been configured or verified. Production readiness still requires OAuth setup and real Drive verification.

## What Lives Where
| Stored in Google Drive | Stored in PostgreSQL (`Attachment`) |
|---|---|
| Supporting documents, Excel estimates, generated PDFs | Attachment metadata and the private Drive file ID |

PostgreSQL never stores file bytes. The browser never receives a Drive ID or direct Drive URL.

Each attachment record stores its contract form ID, Drive file ID, stored and original filenames,
optional display name, MIME type, size, document category, uploader ID, and upload timestamp.
Repeated uploads are separate attachment records; duplicate stored filenames are disambiguated,
but files do not have a separate version sequence. A generated final PDF is stored as
`GENERATED_PDF` only after the parent contract is approved; its approval status is the parent
contract's status rather than a duplicated per-file field.

## Configuration
Set these backend-only values in `backend/.env` or the deployment secret store:

- Personal My Drive: set `GOOGLE_DRIVE_AUTH_MODE=oauth` and configure the OAuth client ID, client secret, and refresh token in secrets. The backend uses the narrow `drive.file` scope and creates an app-owned root folder when no folder ID is configured.
- Workspace Shared Drive: set `GOOGLE_DRIVE_AUTH_MODE=service-account`, provide `GOOGLE_APPLICATION_CREDENTIALS` as a key-file path under gitignored `backend/secrets/`, and set the approved `GOOGLE_DRIVE_FOLDER_ID`.

Never commit credentials or set them in frontend/`NEXT_PUBLIC_` configuration. A configured OAuth folder ID must be app-created or explicitly selected by the OAuth app; an arbitrary existing folder may not be visible under `drive.file`. Service accounts cannot own files in a person's My Drive. See [google-drive-setup.md](google-drive-setup.md) for setup details.

The configured folder is the root; the backend creates/reuses one child folder per contract form. Files are not made public. The backend uses the Drive `drive.file` scope and mediates every download.

## Upload Policy
The approved settings in `.env.example` allow PDF, Excel, CSV, Word, PNG/JPEG and TXT files; each file is limited to 10 MiB and each request to 5 files. Contract records, approval history, and documents are retained for the contract lifetime; audit logs are retained at least 7 years, subject to organizational and legal requirements. No automatic deletion is allowed. Authorized administrative deletion must be recorded in the audit history.

PDFs may be uploaded as `SUPPORTING` documents. `COST_ESTIMATE_EXCEL` accepts Excel spreadsheets (`.xls` or `.xlsx`) only; PDFs are not cost-estimate spreadsheets.

Contract deletion is a manual Admin-only action that requires a reason and explicit confirmation. It first removes the contract's Drive files; if that fails, database records are retained so the Admin can retry. On success, the approval workflow and contract data are deleted, all existing audit events are retained without their contract foreign key, and a `CONTRACT_DELETED` audit event records the Admin and reason. No retention/deletion job runs automatically.

Validation checks extension, reported MIME type, filename, size, and request file count. It does not claim antivirus or malware scanning.

## Application Routes
- `POST /api/forms/:formId/attachments` — contract creator or Admin upload while the form is editable (`DRAFT` or `RETURNED`); multipart fields are `category`, repeated `displayNames`, and repeated `files`.
- `GET /api/forms/:formId/attachments` — metadata for the contract creator, an assigned approver, or Admin.
- `DELETE /api/forms/:formId/attachments/:attachmentId` — Admin or contract creator on a draft/returned form; removes a user-uploaded file and records deletion in audit history. Generated PDFs cannot be removed individually.
- `GET /api/forms/:formId/attachments/:attachmentId/view` — inline view for supported types, after the same access check.
- `GET /api/forms/:formId/attachments/:attachmentId/download` — backend-mediated download, after the same access check.
- `GET /api/forms/:formId/pdf` — creator, assigned approver, or Admin downloads a current saved-contract snapshot; it is generated on demand and is not stored in Drive.
- `POST /api/forms/:formId/final-pdf/generate` — creator, assigned approver, or Admin generates or retrieves the approved final PDF attachment. The returned metadata is safe to pass to the existing attachment download route.
- `POST /api/forms/:formId/final-pdf` — Admin or assigned Approver downloads a ZIP containing the final contract PDF and all supporting files. The existing final PDF is reused; if none exists, the normal PDF service creates and stores it first. Final approval also triggers PDF generation automatically.
- `DELETE /api/forms/:formId` — Admin only; requires a reason and explicit confirmation, removes Drive files before database records, and retains prior audit events plus an audit event for the deletion.

The backend checks form access on every list, delete, view, and download request, and verifies that the attachment belongs to the requested form. A mismatched attachment/form ID is treated as not found. It returns safe metadata only and never returns the Drive ID. Files remain private in Drive; users access them only through these checked backend routes.

## Remaining External Verification
1. Configure OAuth credentials only in local/deployment secrets; leave the folder ID blank to use an app-owned root under `drive.file`.
2. Test upload, download, and cleanup using a non-production folder, then verify private sharing settings.
3. Obtain the company sample contract PDF for final visual acceptance of generated PDFs.
