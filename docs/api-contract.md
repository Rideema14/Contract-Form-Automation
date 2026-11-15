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
