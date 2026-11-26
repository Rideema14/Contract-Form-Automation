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
- The contract creator or Admin may upload while a form is `DRAFT` or `RETURNED`; the creator, an assigned approver, or Admin may list, view, or download its attachments.
- Every attachment is checked against its form before access is granted. Drive file IDs remain private to the backend.
- Upload validation: type allow-list, size limit, sanitized file names.

## Audit Logging
The audit history records contract creation and edits (including bidder, quotation, evaluation, and cost-line changes); submission, resubmission, deletion, approval, return, and rejection; user creation, updates, and role changes; reference-data creation, updates, and deletion; form-schema draft saves and publications; attachment uploads; and successfully generated final PDFs. Form-related events are linked to the contract record. Entries are append-only, include the actor, action, entity, timestamp, and relevant non-secret details, and are viewable by Admin.

Login outcomes and attachment views/downloads are not currently recorded in the audit history.

## Other Controls
- CORS restricted to the frontend origin.
- Security headers (e.g., helmet, only if added as an approved dependency).
- Secrets only in environment variables; `.env` is git-ignored.
- Prisma parameterized queries prevent SQL injection.
- Prevent mass assignment by whitelisting fields in Zod schemas.
