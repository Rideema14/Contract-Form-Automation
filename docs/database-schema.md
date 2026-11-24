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

`ContractForm.budgetProvision` records the planned total budget separately from the estimated contract
amount. `ContractForm.taxAmount` stores an explicit tax amount in the contract currency; totals add it
to the cost-line subtotal without assuming a tax rate. Existing contracts default to zero tax.

## Versioned Form Builder
- `FormSchemaVersion` stores immutable published definitions with unique, increasing version numbers.
- `FormSchemaDraft` stores the editable Admin draft separately from published definitions.
- Each `ContractForm` is linked to its original `FormSchemaVersion` and stores custom field values in
  `dynamicValues`. The additive migration assigns existing contracts and drafts to an empty legacy
  version; subsequent publications do not alter those records or their values.
- Contract-to-version deletion is restricted, and no API updates or deletes published versions.

## Migration workflow
- Local: `npx prisma migrate dev --name descriptive_change` (from `backend/`)
- Commit `schema.prisma` and `prisma/migrations/`
- Teammates pull, then run migrations on their own local database
- Production only: `npx prisma migrate deploy`
- Never run `prisma migrate reset` or `db push` against shared/production data
- Never edit a migration already applied to a shared environment - add a new one
