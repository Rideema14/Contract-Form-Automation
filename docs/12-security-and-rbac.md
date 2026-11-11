# 12. Security and RBAC

## Principles
- **The backend enforces all permissions.** Hiding UI elements is cosmetic only.
- Least privilege; deny by default.
- Validate every input with Zod on the server.

## Authentication
- Passwords stored as strong hashes (bcrypt or argon2; to be chosen), never plain text.
- Token-based sessions (JWT assumed) with expiry; secret from environment.
- Login rate limiting and generic error messages (proposed).
- Method may change if the company requires SSO (CL-20).

## Role Permissions (proposed; pending CL-02, CL-15)
| Capability | User | Approver (assigned) | Admin |
|---|---|---|---|
| Create/edit own draft or returned form | Yes | n/a | Yes (to confirm) |
| Submit own form | Yes | n/a | Yes |
| View own forms | Yes | Yes | Yes |
| View forms in approval chain | No | Yes | Yes |
| View all forms/register | No | No | Yes |
| Approve/return/reject | No | Only current step | Only if assigned (to confirm) |
| Manage users and reference data | No | No | Yes |
| View audit logs | Own forms | No | Yes |

## Ownership Checks
Middleware verifies the requester is the form's creator, an assigned approver, or Admin before returning or modifying form data and related records (bidders, evaluations, estimates, documents).

## Protected Documents
- Files are stored privately in Google Drive; no public links.
- Downloads are streamed via the backend after a permission check.
- Upload validation: type allow-list, size limit, sanitized file names.

## Audit Logging
Logged: login success/failure, form create/update/submit, status changes, approval actions, document upload/download, PDF generation, user/role changes. Each entry has actor, action, entity, timestamp. Logs are append-only and viewable by Admin.

## Other Controls
- CORS restricted to the frontend origin.
- Security headers (e.g., helmet, only if added as an approved dependency).
- Secrets only in environment variables; `.env` is git-ignored.
- Prisma parameterized queries prevent SQL injection.
- Prevent mass assignment by whitelisting fields in Zod schemas.
