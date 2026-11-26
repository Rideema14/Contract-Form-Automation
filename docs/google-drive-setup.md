# Google Drive Integration and Setup

## 1. Overview

Google Drive is integrated into the Contract Forms Automation application for storing supporting documents and generated contract PDFs.

All Google Drive operations are handled exclusively by the Express backend using the Google Drive API v3.

The frontend never communicates directly with Google Drive and never receives private Google credentials.

The application uses **Google OAuth 2.0 with the `drive.file` scope** and personal Google My Drive storage.

## 2. Document Upload Flow

When a user uploads a supporting document, the following process takes place:

```text
USER BROWSER
     |
     v
EXPRESS UPLOAD ENDPOINT
     |
     v
AUTHENTICATION & AUTHORIZATION
     |
     v
FILE VALIDATION
(Size / Type / Content)
     |
     v
GOOGLE DRIVE API
     |
     v
PRIVATE CONTRACT FOLDER
     |
     v
POSTGRESQL
(Drive File ID + Document Metadata)
     |
     v
SAFE METADATA RESPONSE
```

### Upload Process

1. The user selects a document through the application.
2. The frontend sends the file to the backend upload endpoint.
3. The backend authenticates the user and checks authorization.
4. The backend validates file size, type, extension, and content.
5. The document is uploaded to the appropriate private Google Drive contract folder.
6. The backend saves the Drive File ID and associated metadata in PostgreSQL.
7. The application returns safe document metadata to the frontend.

## 3. Document Download Flow

Documents are accessed through authorized backend routes.

Before allowing a download:

1. The backend authenticates the requesting user.
2. It checks whether the user is authorized to access the related contract.
3. It retrieves the document reference from the database.
4. It fetches the file from Google Drive.
5. It returns the document through the authorized application route.

A Google Drive File ID alone does not grant permission to access a document.

The backend performs authorization checks for document access rather than relying on the secrecy of the file identifier.

## 4. Google Cloud Configuration

The integration requires a Google Cloud project with the Google Drive API enabled.

### Setup Steps

**Step 1: Create a Google Cloud Project**

- Create a project in Google Cloud Console.
- Enable the Google Drive API.
- Configure the OAuth consent screen.

**Step 2: Configure OAuth Credentials**

- Create an OAuth 2.0 client.
- Configure the approved OAuth consent flow.
- Request the `drive.file` scope.
- Enable offline access to obtain a refresh token.

The application uses OAuth credentials to access files created or explicitly selected for the application.

**Step 3: Configure Environment Variables**

Store the following configuration securely in `backend/.env` for local development or the deployment secret store for the deployed environment:

```env
GOOGLE_DRIVE_AUTH_MODE=oauth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_DRIVE_FOLDER_ID=
```

Leave `GOOGLE_DRIVE_FOLDER_ID` empty when the application should create its own root folder.

An existing folder can be configured only when it has been created by or explicitly selected for the OAuth application.

Never expose these credentials through frontend environment variables.

## 5. Storage Organization

The application organizes files into contract-specific folders.

The folder structure follows this pattern:

```text
GOOGLE DRIVE
     |
     v
APPLICATION ROOT FOLDER
     |
     |---- CF-2026-0001
     |       |---- Supporting Document 1.pdf
     |       |---- Supporting Document 2.pdf
     |       |---- CF-2026-0001.pdf
     |
     |---- CF-2026-0002
     |       |---- Supporting Document.pdf
     |       |---- CF-2026-0002.pdf
     |
     |---- CF-SHOW-0009
             |---- Supporting Document.pdf
             |---- CF-SHOW-0009.pdf
```

The backend creates or reuses one child folder for each contract under the application-owned or configured root folder.

### Folder Naming

- Contract folders use the contract reference number as their name.
- A contract reference is assigned when a draft is first saved, before supporting documents can be uploaded.
- Existing UUID-named folders are renamed in place the next time a file is uploaded or the final PDF is stored.
- Original filenames of uploaded supporting documents are preserved.
- Generated final PDFs use the contract reference number as their filename.

## 6. Document Metadata

The application stores document metadata in PostgreSQL while the actual files remain in Google Drive.

The metadata includes:

| Field | Description |
|---|---|
| Drive File ID | Unique Google Drive identifier for the stored file. |
| Original Filename | Name of the uploaded document. |
| MIME Type | Content type of the file. |
| Category | Document category, such as Supporting document. |
| Uploader | User who uploaded the document. |
| Upload Date | Date and time of upload. |
| Related Contract ID | Contract associated with the document. |

This separation allows the application to manage document information and permissions without storing file contents directly in PostgreSQL.

## 7. Security and Access Control

The Google Drive integration follows these security principles:

- Google Drive is accessed only by the backend.
- OAuth credentials and refresh tokens remain private.
- Files are stored without public sharing permissions.
- Files are never configured as "Anyone with the link".
- A public API key is not sufficient for private document uploads.
- Backend authorization is checked before document downloads.
- A Drive File ID is never treated as proof of authorization.
- The frontend receives safe metadata rather than private Google credentials.

## 8. File Upload Restrictions

The application follows the configured file validation policy.

| Restriction | Configuration |
|---|---|
| Maximum File Size | 10 MiB per file |
| Maximum Files per Request | 5 |
| Allowed Extensions | Defined in `backend/.env.example` |
| File Validation | Backend-side validation |
| Storage | Private Google Drive |
| Metadata Storage | PostgreSQL |

The backend validates uploaded files before storing them.

The approved extension list is maintained in the backend environment configuration.

## 9. Document Deletion and Retention

The application follows controlled document deletion and retention rules.

- Contract records are retained for the lifetime of the contract.
- Audit logs are retained for at least seven years.
- Documents are not deleted automatically.
- An Admin can manually delete individual user-uploaded attachments at any time.
- The creator can delete their uploaded attachments only when the contract is in Draft or Returned status.
- Successful attachment deletions are recorded in audit history.

Document deletion follows the application's authorization and audit requirements.

## 10. Failure Handling

Google Drive uploads and PostgreSQL metadata operations are separate operations and do not form a single database transaction.

The backend must account for failures such as:

- Google Drive upload failure.
- Database metadata save failure after a successful upload.
- Google OAuth token or permission errors.
- Document retrieval failures.
- Unauthorized document access.

Upload failures are logged, and retry or cleanup procedures are used to handle orphaned files and maintain consistency between Google Drive and PostgreSQL.

## 11. Production Configuration

The deployed backend uses securely configured Google OAuth credentials.

Production configuration follows the same private-storage and authorization rules as local development.

Sensitive values are maintained through the deployment environment's secure configuration mechanism and are never committed to source control.

The frontend communicates with the backend API for all document operations.

## 12. Source Code References

The Google Drive integration and document handling implementation are maintained in:

| File | Responsibility |
|---|---|
| `backend/src/modules/documents/drive.service.ts` | Google Drive API operations and file storage. |
| `backend/src/modules/documents/documents.runtime.ts` | Document service runtime configuration. |
| `backend/src/modules/documents/attachments.router.ts` | Attachment-related API routes and document operations. |
| `backend/.env.example` | Documents the required environment configuration and file restrictions. |

## 13. Important Security Rules

- Never commit `backend/.env` or OAuth credentials.
- Keep `backend/secrets/` out of source control.
- Never expose Google credentials through `NEXT_PUBLIC_` variables.
- Never make private contract documents publicly accessible.
- Always perform backend authorization before accessing stored files.
- Use the approved OAuth configuration and the minimum required Drive permissions.