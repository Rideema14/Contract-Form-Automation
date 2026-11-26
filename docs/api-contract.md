# API Contract

## 1. Overview

The Contract Forms Automation application exposes REST APIs through an Express and TypeScript backend.

The APIs handle authentication, user management, contract operations, bidder information, cost estimates, approvals, document management, PDF generation, dashboard data, and administrative operations.

All API requests are handled by the backend, which communicates with PostgreSQL through Prisma ORM and integrates with Google Drive for private document storage.

## 2. Base URL

The API base URL is environment-dependent.

| Environment | Base URL |
|---|---|
| Local Development | `http://localhost:4000/api` |
| Deployed Application | Configured through the deployment environment |

The frontend uses `NEXT_PUBLIC_API_BASE_URL` to communicate with the backend.

## 3. Response Convention

API responses follow a consistent JSON response structure.

Example success response:

```json
{
  "success": true,
  "message": "Operation completed successfully"
}
```

Example error response:

```json
{
  "success": false,
  "message": "An error occurred"
}
```

Individual endpoints may include additional response data depending on the operation.

## 4. Implemented API Modules

The backend organizes API functionality into the following modules:

| Module | Responsibility |
|---|---|
| Health | Checks backend availability and database connectivity. |
| Authentication | Handles user login, authentication, and session-related operations. |
| Users | Manages user information and role-related operations. |
| Contracts | Handles contract creation, retrieval, updates, submission, and management. |
| Bidders | Manages bidders and quotation information associated with contracts. |
| Cost Estimates | Handles contract cost breakdowns and financial information. |
| Approvals | Manages approval workflows, assigned approvers, decisions, and comments. |
| Attachments | Handles supporting document uploads, retrieval, and downloads through Google Drive integration. |
| PDF | Generates contract PDF documents. |
| Dashboard | Provides contract and workflow information for dashboard views. |
| Admin | Provides administrative functionality and reference-data management. |
| Form Builder | Manages editable form drafts and published form schema versions. |

Route implementations are maintained under:

```text
backend/src/routes/
```

## 5. Health Check APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Checks whether the backend API is responding. |
| GET | `/api/health/` | Returns backend service status information. |
| GET | `/api/health/db` | Checks database connectivity through Prisma. |

### Example: API Health

```json
{
  "success": true,
  "message": "API is online"
}
```

### Example: Database Health

```json
{
  "success": true,
  "message": "Database connection is healthy"
}
```

These endpoints help verify backend availability and database connectivity.

## 6. Authentication and Authorization

The application uses JWT-based authentication with secure HttpOnly cookies.

Role-Based Access Control (RBAC) is enforced by the backend.

Supported roles:

- `ADMIN`
- `SUBMITTER`
- `APPROVER`

Authorization is checked on the server before protected operations are performed.

Users can access only the resources and actions permitted by their assigned roles.

## 7. Contract Form Builder APIs

The Form Builder provides APIs for managing configurable contract form definitions.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/form-builder/published` | Authenticated users | Returns the latest published form schema version. |
| GET | `/api/form-builder/draft` | ADMIN | Retrieves the editable configuration draft and latest published version. |
| PUT | `/api/form-builder/draft` | ADMIN | Saves a validated form configuration draft. |
| POST | `/api/form-builder/publish` | ADMIN | Publishes the draft as the next immutable schema version. |

### Versioned Form Submission

New contract creation requests can include:

- `formSchemaVersionId`
- `dynamicValues`

The backend validates the submitted schema version and associates the new contract with the applicable published version.

Draft updates preserve the contract's original schema version and save custom field values in `dynamicValues`.

During submission, the backend validates required and typed custom field values.

Contract detail responses include the associated form schema version and dynamic values for rendering.

Published form schema versions are immutable and cannot be modified or deleted through the application.

## 8. Contract and Workflow Operations

The API supports the complete contract lifecycle, including:

- Creating and managing contract drafts.
- Retrieving contract details.
- Managing bidders and quotation information.
- Managing cost estimates.
- Submitting contracts for approval.
- Reviewing assigned contracts.
- Recording approval decisions and comments.
- Returning contracts for necessary changes.
- Tracking contract status and approval history.

All operations are subject to authentication, role permissions, and server-side business validation.

## 9. Document and PDF Operations

The document-related APIs support:

- Uploading supporting documents.
- Storing document metadata.
- Associating attachments with contract records.
- Accessing authorized documents.
- Downloading or opening permitted attachments.
- Generating contract PDFs.

Google Drive is used for private file storage. The backend controls document access and communicates with Google Drive using its configured credentials.

PDF generation is handled by PDFMake inside the Express backend.

## 10. Dashboard and Administrative Operations

The dashboard APIs provide application data used to display contract information and workflow progress.

Administrative APIs support authorized management operations, including user, role, and reference-data management.

Access to administrative operations is restricted to authorized users.

## 11. API Security

The backend applies security controls to API operations:

- JWT-based authentication.
- Secure HttpOnly cookie handling.
- Role-based authorization.
- Server-side input validation.
- Protection against unauthorized cross-user resource access.
- CORS configuration.
- Security headers through Helmet.
- Rate limiting where configured.
- Controlled access to private Google Drive documents.

The frontend does not directly access the database or private Google Drive credentials.

## 12. API Implementation Reference

The backend route implementations are maintained in:

```text
backend/src/routes/
```

Related business logic and services are maintained within the backend modules.

For exact HTTP methods, route paths, request parameters, validation rules, and response fields, refer to the corresponding route implementations and their associated tests.

## 13. API Testing

API behavior is verified through the project's automated test suite using Vitest and Supertest.

Testing covers relevant API functionality, validation, authentication, authorization, and business workflows.

Run backend tests from the `backend/` directory:

```powershell
npm test
```