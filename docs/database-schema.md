# Database schema

The first migration (`backend/prisma/migrations/*_init`) contains only the `User` model and `UserRole`
enum (ADMIN, SUBMITTER, APPROVER). It is a connectivity smoke test, **not** the final contract schema.

## Planned entities (to be agreed as a team before building features)
- User - account, email, password hash, active status and role
- Department - sponsor departments and reference data
- Vendor and VendorType - reusable vendor master data
- Currency - allowed currency codes and display names
- ContractForm - one main request record (project, procurement, sponsor, budget, status)
- Bidder - multiple bidders/quotes attached to one ContractForm
- CostLine - multiple cost breakdown rows attached to one ContractForm
- Attachment - form relation, Drive File ID, filename, MIME type, category, uploader, timestamp
- ApprovalStep / ApprovalDecision - ordered approvers, assigned user, decision, comments, timestamps
- AuditLog - actor, action, entity, entity ID, timestamp, metadata
- Optional: Notification

Rules: use Decimal/Numeric for money (never floats); add constraints and indexes for unique email,
contract number, status, created date and common search filters. Agree relationships, required fields,
delete rules and status enums first.

## Migration workflow
- Local: `npx prisma migrate dev --name descriptive_change` (from `backend/`)
- Commit `schema.prisma` and `prisma/migrations/`
- Teammates pull, then run migrations on their own local database
- Production only: `npx prisma migrate deploy`
- Never run `prisma migrate reset` or `db push` against shared/production data
- Never edit a migration already applied to a shared environment - add a new one
