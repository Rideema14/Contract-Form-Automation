# 09. Google Drive Integration

> **Status:** Planned (Phase 3). Google Drive is **not configured**. No credentials exist in this repository.

## What Lives Where
| Stored in Google Drive | Stored in PostgreSQL (`documents` table) |
|---|---|
| Actual file contents: supporting documents, Excel estimates, generated PDFs | Metadata only: `id`, `form_id`, `type`, `file_name`, `mime_type`, `size_bytes`, `drive_file_id`, `uploaded_by`, `created_at` |

PostgreSQL never stores file bytes. Drive never stores application logic or permissions.

## Planned Approach
- The backend authenticates to Drive using a **service account** (assumption; confirm with CL-16). Credentials are supplied by environment variables, never committed.
- A root folder (`GOOGLE_DRIVE_ROOT_FOLDER_ID`) holds one subfolder per form (naming convention proposed: by form ID/reference).
- Drive files are **not shared publicly**. Only the service account can access them.

## Upload Flow
1. Client uploads file to `POST /forms/:id/documents` (multipart).
2. Backend verifies login, role, ownership and form status.
3. Validates file type and size (limits per CL-14).
4. Uploads to the form's Drive folder via the Drive API.
5. Saves metadata plus `drive_file_id` in PostgreSQL.
6. Writes an audit log entry.
If the Drive upload fails, no metadata row is created. If the DB write fails after upload, the backend removes the orphaned Drive file.

## Form Association
Each document row carries `form_id`. Generated PDFs use type `GENERATED_PDF` and are versioned (a new PDF adds a row; older ones are retained).

## Access Control and Download
1. Client calls `GET /documents/:id/download`.
2. Backend checks the user is owner, current/past approver of that form, or Admin.
3. Backend streams the file from Drive to the client. The Drive ID and direct Drive links are never exposed.

## Local Development
Until Phase 3, a local stub storage adapter may be used behind the same interface so other modules are unaffected. Environment variables: see `.env.example`.

## Open Questions
CL-14 (types/sizes/retention), CL-16 (account type, folder ownership, quota).
