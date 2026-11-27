# File Access Security

## Storage model

Attachment metadata is stored in PostgreSQL in the `Attachment` model. File bytes are read from or written to Google Drive through the backend document service. The public API does not expose the private `driveFileId`.

Upload categories are:

- `SUPPORTING`
- `COST_ESTIMATE_EXCEL`
- `GENERATED_PDF`

## Authentication

All attachment and PDF routes require the backend `authenticate` middleware and the HTTP-only `contract_token` cookie.

The frontend Next.js API proxy forwards only `contract_token`; it removes browser Authorization headers and unrelated cookies for API requests.

## Verified permissions

| Role/action | Create/upload | View/list/download | Delete |
|---|---|---|---|
| SUBMITTER / contract creator | DRAFT or RETURNED contract only | Creator, plus every contract visibility rule | DRAFT or RETURNED contract only |
| APPROVER | No | Contracts with an assigned approval step | No |
| ADMIN | DRAFT or RETURNED contracts where creator is still required by the implementation | Any contract | Any accessible contract |

The access implementation is centered on `ContractForm.createdById`, role, contract status, and `ApprovalStep.approverId`.

## Backend checks

- Upload: `assertCanUploadAttachments`
- View/list/download/view PDF: `assertCanViewAttachments`
- Delete: `assertCanDeleteAttachments`
- The file record is resolved inside the form ID scope for download and view routes.
- Unauthorized access uses structured 403 or 401 responses.

## Upload safeguards

- Permission checks happen before the Multer middleware writes temporary file bytes.
- File extension, MIME type, file size, and file count are validated from backend environment configuration.
- The backend fails closed if required document-upload configuration is missing.
- Display names are validated and the number of names must match the uploaded file count.

## Download behavior

List responses expose attachment metadata but not Google Drive IDs. View responses may use inline disposition for PDF and image types. Other files and downloads use attachment disposition. Responses use `nosniff`, private no-store caching, and either content length or streamed delivery.

## Google Drive security

Drive credentials are backend-only. The implementation supports:

- OAuth mode
- Service-account mode

Do not publish service-account JSON, OAuth refresh tokens, or folder IDs. Google Drive permissions must restrict access at least to the approved folder and the backend service identity. Direct public sharing should not be assumed.

## Audit behavior

Attachment deletion records an `ATTACHMENT_DELETED` audit log entry. If audit persistence fails after the Drive/metadata delete, the API reports `ATTACHMENT_AUDIT_FAILED`.

## Security findings

- **Needs verification:** Google Drive direct-file sharing is not documented by the repository. File authorization is implemented by the backend, but Drive provider ACLs are external configuration.
- **Needs verification:** Whether generated Drive links or folders are public or private in the live account.
- **Recommended:** use an approved Shared Drive or private OAuth app-owned folder, least-privilege service credentials, and backend-only file delivery.
