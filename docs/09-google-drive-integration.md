# 09. Google Drive Integration

## 1. Overview

The application integrates Google Drive for storing supporting documents, Excel cost estimates, and generated contract PDFs.

The backend integration and authorized attachment routes are implemented. However, a real Google Drive account and folder have not yet been configured and verified. Production readiness requires OAuth configuration and successful end-to-end Drive verification.

Google Drive is used for private file storage, while PostgreSQL stores attachment metadata and references to the corresponding Drive files.

## 2. What Lives Where

| Stored in Google Drive | Stored in PostgreSQL (`Attachment`) |
|---|---|
| Supporting documents | Attachment metadata |
| Excel cost estimates | Private Drive file ID |
| Generated contract PDFs | Contract form association and uploader information |

PostgreSQL does not store file contents. The browser never receives a Google Drive file ID or direct Drive URL.

Each attachment record stores:

- Contract form ID
- Drive file ID
- Stored filename
- Original filename
- Optional display name
- MIME type
- File size
- Document category
- Uploader ID
- Upload timestamp

Repeated uploads create separate attachment records. Duplicate stored filenames are disambiguated, but files do not have a separate version sequence.

A generated final PDF is stored with the category `GENERATED_PDF` only after the parent contract is approved. Its approval status is determined by the parent contract rather than duplicated in the attachment record.

## 3. Google Drive Configuration

The following values must be configured in the backend environment or deployment secret store.

### Option A: Personal Google Drive (OAuth)

For a personal My Drive account:

- Set `GOOGLE_DRIVE_AUTH_MODE=oauth`.
- Configure the OAuth client ID.
- Configure the OAuth client secret.
- Configure the OAuth refresh token.
- Use the narrow `drive.file` scope.

When no folder ID is configured, the backend creates an application-owned root folder.

### Option B: Google Workspace Shared Drive (Service Account)

For an approved Workspace Shared Drive:

- Set `GOOGLE_DRIVE_AUTH_MODE=service-account`.
- Configure `GOOGLE_APPLICATION_CREDENTIALS` with a key-file path under the Git-ignored `backend/secrets/` directory.
- Set the approved `GOOGLE_DRIVE_FOLDER_ID`.

Service accounts cannot own files in a person's My Drive. They should be used with an appropriately configured Shared Drive.

### Security Requirements

- Never commit OAuth credentials, refresh tokens, or service-account keys.
- Never expose Google Drive credentials through frontend environment variables or `NEXT_PUBLIC_` configuration.
- An OAuth-configured folder must be created by the application or explicitly selected by the OAuth application. An arbitrary existing folder may not be accessible with the `drive.file` scope.
- Files must not be made publicly accessible.
- All file access must be mediated by the backend.

Refer to `google-drive-setup.md` for detailed configuration instructions.

## 4. Folder Organization

The configured Google Drive folder acts as the application root folder.

The backend creates or reuses a separate child folder for each contract form.

This keeps supporting documents, cost estimates, and generated PDFs organized by contract.

Files remain private in Google Drive. Users access them through authorized application routes rather than direct Drive links.

## 5. Upload Policy

The approved settings in `.env.example` define the supported file types and upload limits.

| Setting | Policy |
|---|---|
| Supported document formats | PDF, Excel, CSV, Word, PNG, JPEG, TXT |
| Maximum file size | 10 MiB per file |
| Maximum files per request | 5 |
| Cost estimate formats | `.xls` and `.xlsx` |
| Supporting documents | PDF and other allowed document formats |

PDF files can be uploaded as `SUPPORTING` documents.

The `COST_ESTIMATE_EXCEL` category accepts Excel spreadsheets (`.xls` or `.xlsx`) only. PDF files cannot be uploaded as cost-estimate spreadsheets.

### File Validation

The backend validates:

- File extension
- Reported MIME type
- Filename
- File size
- Number of files in the request

These checks do not constitute antivirus or malware scanning.

## 6. Retention and Deletion Policy

The application follows the following retention rules:

- Contract records, approval history, and supporting documents are retained for the lifetime of the contract.
- Audit logs are retained for at least seven years, subject to organizational and legal requirements.
- No automatic file or contract deletion job is allowed.
- Authorized administrative deletion must be recorded in the audit history.

### Contract Deletion

Contract deletion is a manual Admin-only action that requires a reason and explicit confirmation.

The deletion process follows these steps:

1. The Admin submits a deletion request with a reason and confirmation.
2. The backend removes the contract's associated Google Drive files.
3. If Drive deletion fails, database records are retained so the Admin can retry.
4. If Drive deletion succeeds, the contract data and approval workflow records are deleted.
5. Existing audit events are retained without their contract foreign key.
6. A `CONTRACT_DELETED` audit event records the Admin and deletion reason.

No automatic retention or deletion job runs in the background.

## 7. Application Routes

The following backend routes handle attachment and PDF operations.

| Method | Endpoint | Description | Access |
|---|---|---|---|
| POST | `/api/forms/:formId/attachments` | Upload supporting documents | Contract creator or Admin; form must be editable |
| GET | `/api/forms/:formId/attachments` | Retrieve attachment metadata | Creator, assigned approver, or Admin |
| DELETE | `/api/forms/:formId/attachments/:attachmentId` | Delete a user-uploaded attachment | Admin or creator of a draft/returned form |
| GET | `/api/forms/:formId/attachments/:attachmentId/view` | View a supported file inline | Authorized users |
| GET | `/api/forms/:formId/attachments/:attachmentId/download` | Download a file through the backend | Authorized users |
| GET | `/api/forms/:formId/pdf` | Generate and download a current contract PDF snapshot | Creator, assigned approver, or Admin |
| POST | `/api/forms/:formId/final-pdf/generate` | Generate or retrieve the approved final PDF | Creator, assigned approver, or Admin |
| POST | `/api/forms/:formId/final-pdf` | Download a ZIP containing the final PDF and supporting files | Admin or assigned approver |
| DELETE | `/api/forms/:formId` | Delete a contract and its associated files | Admin only |

### Route Behaviour

**Attachment upload**

- The contract creator or Admin can upload attachments while the form is in `DRAFT` or `RETURNED` status.
- Multipart fields include `category`, repeated `displayNames`, and repeated `files`.

**Attachment listing**

- Returns safe attachment metadata for authorized users.
- Does not expose private Drive file IDs or direct Drive URLs.

**Attachment deletion**

- An Admin can delete eligible user-uploaded attachments.
- The contract creator can delete attachments only while the form is in `DRAFT` or `RETURNED` status.
- Individual generated PDFs cannot be deleted through this route.
- Deletion is recorded in the audit history.

**File viewing and downloading**

- Files are streamed through the backend.
- The same authorization checks apply to both viewing and downloading.
- The backend verifies that the requested attachment belongs to the specified contract form.

**Current PDF snapshot**

- `GET /api/forms/:formId/pdf` generates a PDF snapshot from the currently saved contract data.
- It is generated on demand and is not stored in Google Drive.

**Final PDF generation**

- `POST /api/forms/:formId/final-pdf/generate` is available only for approved contracts.
- It generates or retrieves the official final PDF attachment.
- The returned attachment metadata can be used with the authorized attachment download route.

**Final PDF package**

- `POST /api/forms/:formId/final-pdf` returns a ZIP containing the final contract PDF and supporting files.
- An existing final PDF is reused. If one does not exist, the PDF service generates and stores it first.
- Final approval also triggers PDF generation automatically.

## 8. Backend Authorization and File Security

Every attachment operation performs backend authorization checks.

The backend verifies:

1. The requesting user is authenticated.
2. The user has permission to access the contract.
3. The attachment belongs to the requested contract form.
4. The requested operation is permitted for the user's role and the form's current status.

A mismatched attachment ID and contract form ID are treated as not found.

The backend returns safe attachment metadata only. Private Google Drive IDs and direct file URLs are never exposed to the browser.

## 9. External Configuration and Verification

The backend integration is implemented, but the following external configuration and verification steps are required before the Google Drive integration can be considered production-ready:

1. Configure OAuth credentials in local or deployment secrets.
2. Leave the folder ID blank when using an application-created root folder under `drive.file`, unless an approved folder has been explicitly selected.
3. Test file uploads using a non-production Google Drive folder.
4. Verify file viewing and downloading through the application.
5. Verify that uploaded files remain private and are not publicly shared.
6. Test file cleanup and deletion behaviour.
7. Obtain the company's sample contract PDF for final visual acceptance of generated PDFs.

These checks validate the complete integration between the application backend, PostgreSQL metadata, and Google Drive storage.