# API contract

Base URL (local): `http://localhost:4000/api`

Response convention: `{ "success": boolean, "message": string, ... }`

## Implemented
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{ success: true, message: "API is online" }` - backend is responding |
| GET | `/api/health/` | `{ success: true, message: "Backend is running", service: "contract-forms-api" }` |
| GET | `/api/health/db` | `{ success: true, message: "Database connection is healthy" }` - backend can query PostgreSQL through Prisma |

## Planned (routes live in `backend/src/routes/`)
auth, users, contracts, bidders, cost-estimates, approvals, attachments, pdf, dashboard, admin.

Agree and document here before implementing each module: endpoint list, request/response shapes,
status enums, error response format, pagination and filters.

## Contract Form Builder
| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/form-builder/published` | Authenticated users | Returns the latest immutable form schema version |
| GET | `/api/form-builder/draft` | ADMIN | Returns the editable configuration draft and latest published version |
| PUT | `/api/form-builder/draft` | ADMIN | Saves a validated configuration draft |
| POST | `/api/form-builder/publish` | ADMIN | Publishes the draft as the next immutable version |

New `POST /api/forms` requests may include `formSchemaVersionId` and `dynamicValues`. The server
rejects a stale published version and pins the new contract to the latest version. Draft updates
save `dynamicValues` against that pinned version; submission validates required and typed values.
Contract detail responses include the pinned `formSchemaVersion` and values for read-only rendering.
Published schemas are never updated or deleted.
