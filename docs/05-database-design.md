# Database Design

## Implementation

- Engine: PostgreSQL
- ORM: Prisma 6.19.3
- Schema: `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations`
- Prisma configuration: `backend/prisma.config.ts`

The datasource reads `DATABASE_URL`. Use PostgreSQL redacted format:

```text
postgresql://USER:PASSWORD@HOST:5432/contract_automation?sslmode=require&schema=public
```

Do not include real credentials in documentation.

## Core entities

| Model | Purpose |
|---|---|
| `User` | Authentication identity, role, department, owned forms and approvals |
| `Department` | Sponsor/organizational department |
| `ContractCategory` | Contract category |
| `VendorType` | Vendor classification |
| `Currency` | ISO-style code and display name |
| `Vendor` | Vendor master record |
| `ContractForm` | Contract draft/submission and dynamic form values |
| `FormSchemaVersion` | Published form definition |
| `FormSchemaDraft` | Active administrator form draft |
| `Bidder` | Bidder participating in a contract |
| `Quotation` | Bidder quotation amount |
| `Evaluation` | Technical or commercial bidder evaluation |
| `CostLine` | Contract cost breakdown line |
| `Attachment` | Google Drive file metadata |
| `ApprovalStep` | Sequential assigned approval step |
| `ApprovalDecision` | Approver decision and comment |
| `AuditLog` | Auditable application actions |
| `Notification` | In-app recipient notification |

## Enums

- `UserRole`: `ADMIN`, `SUBMITTER`, `APPROVER`
- `ContractStatus`: `DRAFT`, `PENDING_APPROVAL`, `RETURNED`, `APPROVED`, `REJECTED`
- `ApprovalStatus`: `WAITING`, `PENDING`, `APPROVED`, `RETURNED`, `REJECTED`
- `ApprovalDecisionValue`: `APPROVED`, `RETURNED`, `REJECTED`
- `AttachmentCategory`: `SUPPORTING`, `COST_ESTIMATE_EXCEL`, `GENERATED_PDF`
- `EvaluationType`: `TECHNICAL`, `COMMERCIAL`

## Relationships

```mermaid
erDiagram
  User ||--o{ ContractForm : creates
  Department ||--o{ User : contains
  Department ||--o{ ContractForm : sponsors
  ContractCategory ||--o{ ContractForm : categorizes
  Currency ||--o{ ContractForm : prices
  Currency ||--o{ Quotation : prices
  ContractForm ||--o{ Bidder : has
  Vendor ||--o{ Bidder : may_supply
  Bidder ||--o{ Quotation : receives
  ContractForm ||--o{ Evaluation : has
  Bidder ||--o{ Evaluation : receives
  ContractForm ||--o{ CostLine : has
  ContractForm ||--o{ Attachment : has
  ContractForm ||--o{ ApprovalStep : has
  ApprovalStep ||--o{ ApprovalDecision : receives
  ContractForm ||--o{ AuditLog : has
  ContractForm ||--o{ Notification : has
```

## Important constraints

- Unique user email
- Unique department, category, vendor type, and currency names/codes
- Unique form reference number where populated
- Unique bidder per contract and sort order
- Unique contract approval level
- Unique attachment Drive file ID
- Restrict foreign-key deletes for application entities
- Indexes exist for contract status/owner, department/category, timestamps, attachments, approvals, audit logs, and notifications

## Migration commands

```powershell
Set-Location backend
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:studio
```

`db:migrate` creates/applies development migrations. `db:deploy` applies already committed migrations and is the controlled production action.

Before a schema change:

1. Back up the database.
2. Work in a development database.
3. Review the generated SQL/migration.
4. Test upgrade and application compatibility.
5. Apply to production with `db:deploy`.
6. Verify migration status and application health.

Do not edit or delete applied migration directories casually.
