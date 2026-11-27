# API Documentation

## Base URLs

- Local backend: `http://localhost:4000/api`
- Frontend same-origin proxy: `http://localhost:3000/api`
- Azure backend: `https://contract-forms-backend-261126.azurewebsites.net/api`
- Azure frontend: `https://contract-forms-frontend-261126.azurewebsites.net`

Both Azure health endpoints were verified live with HTTP 200 on 2026-11-27:

- `GET https://contract-forms-backend-261126.azurewebsites.net/api/health`
- `GET https://contract-forms-backend-261126.azurewebsites.net/api/health/db`

## Authentication

Login creates an HTTP-only cookie named `contract_token`. The backend expects this cookie rather than a bearer Authorization header.

Use `POST /api/auth/login` with:

```json
{
  "email": "authorized-user@example.test",
  "password": "replace-with-authorized-password"
}
```

Logout: `POST /api/auth/logout`

Current user: `GET /api/auth/me`

Protected responses use an envelope similar to:

```json
{
  "success": false,
  "message": "Authentication required",
  "error": { "code": "AUTHENTICATION_REQUIRED", "details": [] },
  "meta": { "requestId": "uuid" }
}
```

## Health

| Method | Path | Access |
|---|---|---|
| GET | `/api/health` | Public |
| GET | `/api/health/db` | Public |

## Contracts and form data

All contract routes require authentication.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/forms` | Create contract |
| GET | `/api/forms` | List visible contracts |
| GET | `/api/forms/drafts` | List visible drafts |
| GET | `/api/forms/:id` | Get contract |
| PATCH | `/api/forms/:id` | Update contract |
| POST | `/api/forms/:id/save-draft` | Save draft |
| DELETE | `/api/forms/:id` | Delete draft/eligible contract |
| POST | `/api/forms/:id/submit` | Submit or resubmit |

Bidder routes:

- `GET/POST /api/forms/:formId/bidders`
- `PATCH/DELETE /api/forms/:formId/bidders/:bidderId`
- `GET/POST /api/forms/:formId/bidders/:bidderId/quotations`
- `PATCH/DELETE /api/forms/:formId/bidders/:bidderId/quotations/:quotationId`

Cost and evaluation routes:

- `GET/POST/PATCH/DELETE /api/forms/:formId/cost-lines`
- `POST /api/forms/:formId/cost-lines/import`
- `GET /api/forms/cost-estimate/template`
- `GET /api/forms/:formId/cost-estimate`
- `GET /api/forms/:formId/evaluations`
- `PUT /api/forms/:formId/evaluations`

## Approvals

| Method | Path | Role/access |
|---|---|---|
| POST | `/api/approvals/workflow` | Initialize workflow |
| GET | `/api/approvals/pending` | APPROVER or ADMIN |
| GET | `/api/approvals/history/:id` | Authorized contract participant |
| GET | `/api/approvals/forms/:id/history` | Authorized contract participant |
| GET | `/api/approvals/:id` | Authorized participant |
| POST | `/api/approvals/:id/approve` | Assigned approver or admin |
| POST | `/api/approvals/:id/return` | Assigned approver or admin |
| POST | `/api/approvals/:id/reject` | Assigned approver or admin |

## Dashboard, notifications, and admin

- `GET /api/dashboard`
- `GET/PATCH /api/notifications`
- `PATCH /api/notifications/mark-all-read`
- `PATCH /api/notifications/:id/read`
- `GET /api/admin/audit` - ADMIN
- `GET/POST /api/users` - ADMIN for mutations
- `PATCH /api/users/:id` - ADMIN
- `GET /api/users/approvers`

## Reference data and form builder

Reference data:

- `GET /api/reference-data`
- `POST/PATCH/DELETE /api/reference-data/:category...` - ADMIN mutations

Form builder:

- `GET /api/form-builder/published`
- `GET /api/form-builder/draft` - ADMIN
- `PUT /api/form-builder/draft` - ADMIN
- `POST /api/form-builder/publish` - ADMIN

## Attachments and PDFs

All routes require authentication:

- `GET /api/forms/:formId/attachments/config`
- `POST /api/forms/:formId/attachments/validate`
- `GET /api/forms/:formId/attachments`
- `POST /api/forms/:formId/attachments`
- `DELETE /api/forms/:formId/attachments/:attachmentId`
- `GET /api/forms/:formId/attachments/:attachmentId/download`
- `GET /api/forms/:formId/attachments/:attachmentId/view`
- `GET /api/forms/:formId/pdf`
- `POST /api/forms/:formId/final-pdf/generate`
- `POST /api/forms/:formId/final-pdf` - ADMIN or APPROVER

Upload uses `multipart/form-data` with field name `files`, category body field, and matching display names.

## HTTP validation and status codes

Common codes:

- `400` validation or malformed JSON
- `401` missing/invalid authentication
- `403` role, ownership, or cross-origin rejection
- `404` missing resource
- `409` invalid state or conflict
- `500` internal server error
- `503` unavailable document policy/integration

The repository frontend rejects cross-origin mutating API requests and only forwards `contract_token`, range, ETag, download, and no-store headers needed by the proxy.
