# Database Schema

## 1. Overview

The Contract Forms Automation application uses **PostgreSQL** as its relational database, hosted on a shared Azure Database for PostgreSQL server.

**Prisma ORM** is used for database access, schema management, and migrations.

The database stores application users, contract forms, procurement information, vendors, bidders, cost details, document metadata, approval records, and audit information.

The database schema is maintained in:

```text
backend/
└── prisma/
    ├── schema.prisma
    ├── migrations/
    └── migration_lock.toml
```

The Prisma schema defines the application's data models, relationships, enums, and constraints. The migrations directory maintains the database schema's version history.

## 2. Core Database Entities

The database supports the following functional areas:

| Entity | Purpose |
|---|---|
| User | Stores user accounts, email addresses, password hashes, account status, and assigned roles. |
| Department | Maintains sponsor department information and reference data. |
| Vendor | Stores reusable vendor and contractor information. |
| VendorType | Categorizes vendors according to their type. |
| Currency | Maintains supported currency codes and display information. |
| ContractForm | Stores the main contract request, including project details, procurement information, sponsor department, budget, and workflow status. |
| Bidder | Stores multiple bidders and quotation details associated with a contract. |
| CostLine | Stores individual cost breakdown entries associated with a contract. |
| Attachment | Maintains document metadata, including Google Drive file references, filenames, MIME types, categories, uploader information, and timestamps. |
| ApprovalStep | Stores the ordered approval workflow and assigned approvers. |
| ApprovalDecision | Records approval actions, decisions, comments, and timestamps. |
| AuditLog | Records significant application activities, including the actor, action, affected entity, and timestamp. |
| FormSchemaVersion | Stores published versions of the configurable contract form definition. |
| FormSchemaDraft | Stores the editable draft of the Admin-managed form definition. |

The Prisma schema is the source of truth for the exact model definitions, field types, relationships, and constraints.

## 3. User Roles

The application implements Role-Based Access Control (RBAC) using the following roles:

| Role | Responsibility |
|---|---|
| ADMIN | Manages application-wide contract data, reference data, users, roles, and administrative operations. |
| SUBMITTER | Creates and manages contract requests, submits forms, and accesses authorized contract information. |
| APPROVER | Reviews assigned submissions and performs approval-related actions. |

Backend authorization ensures that users can access only the resources and operations permitted by their assigned roles.

## 4. Contract Form Data

The `ContractForm` model represents the main contract request.

It maintains the relationship between the contract and its associated procurement information, including:

- Project and contract identification.
- Sponsor department.
- Contract category and scope.
- Procurement and sourcing information.
- Vendor and bidder information.
- Contract amount and currency.
- Budget information.
- Cost breakdown.
- Supporting document references.
- Approval workflow information.
- Contract status and audit-related information.

### Budget and Tax Handling

The contract stores planned budget information separately from the estimated contract amount.

- `budgetProvision` records the planned total budget.
- `taxAmount` stores an explicit tax amount in the contract currency.
- Cost-line subtotals are calculated separately, and the tax amount is added without assuming a predefined tax rate.
- Existing contracts use zero tax as the default where applicable.

Money-related values use appropriate decimal-based database types rather than floating-point values to avoid precision issues.

## 5. Versioned Form Builder

The application supports versioned contract form definitions.

### FormSchemaVersion

- Stores published form definitions.
- Each published version has a unique, increasing version number.
- Published definitions are treated as immutable.

### FormSchemaDraft

- Stores the editable Admin draft.
- Allows changes to form definitions before publication.
- Keeps unpublished changes separate from published versions.

### ContractForm Relationship

- Each contract is associated with the form schema version used when it was created.
- Custom field values are stored in `dynamicValues`.
- Existing contracts and drafts are assigned to an empty legacy version through the relevant migration.
- Publishing a new form schema does not modify previously created contracts or their stored values.
- Contract references to published versions are protected against deletion.

## 6. Database Relationships

The database uses relational associations to maintain consistency between contract records and their related information.

Conceptually, the relationships include:

- A user can create multiple contract forms.
- A contract form can contain multiple bidders.
- A contract form can contain multiple cost lines.
- A contract form can have multiple supporting attachments.
- A contract form can have multiple approval steps and decisions.
- Users can be assigned to approval workflows.
- Audit records identify the user and entity associated with an activity.
- Contract forms reference their applicable published form schema version.

Refer to `backend/prisma/schema.prisma` for the exact foreign keys, cardinalities, and delete behavior.

## 7. Data Integrity and Constraints

The database schema uses relational constraints and appropriate indexes to maintain data consistency and support application queries.

Important considerations include:

- Unique user email addresses.
- Unique contract reference numbers.
- Appropriate foreign key relationships.
- Decimal-based fields for monetary values.
- Status and role enums where applicable.
- Indexes for frequently queried fields and common filtering operations.
- Controlled deletion behavior for related records.

## 8. Migration Management

Prisma Migrate manages database schema changes.

Migration files are maintained in:

```text
backend/prisma/migrations/
```

The repository contains the existing migration history required to reproduce the database schema.

### Migration Workflow

**Development:**

For changes developed against an isolated local development database:

```powershell
cd backend
npx prisma migrate dev --name descriptive_change
```

**Generate Prisma Client:**

```powershell
npx prisma generate
```

**Production / Shared Environment:**

Apply reviewed and committed migrations through the controlled deployment process:

```powershell
npx prisma migrate deploy
```

### Migration Rules

- Commit both `schema.prisma` and the corresponding migration files.
- Never edit a migration that has already been applied to a shared environment.
- Introduce schema changes through new migrations.
- Never run `prisma migrate reset` against shared or production databases.
- Never use `prisma db push` as a substitute for the controlled migration workflow on shared or production databases.
- Verify migration status before applying schema changes to the shared Azure database.

## 9. Database Environment

| Property | Configuration |
|---|---|
| Database Engine | PostgreSQL |
| Hosting | Azure Database for PostgreSQL |
| Database Name | `contract_automation` |
| Schema | `public` |
| ORM | Prisma |
| Schema Definition | `backend/prisma/schema.prisma` |
| Migration Directory | `backend/prisma/migrations/` |
| Connection | Backend through Prisma ORM |
| Security | Credentials managed through environment variables; SSL-enabled connection |

**Security:** Database credentials and connection strings are private configuration values. They must never be committed to the repository or included in public documentation.

## 10. Database Access

The frontend never connects directly to PostgreSQL.

All database operations are performed through the Express backend using Prisma ORM.

The backend is responsible for:

- Database queries and updates.
- Input validation.
- Authentication and authorization checks.
- Maintaining relationships between contract records.
- Enforcing business rules.
- Recording relevant application activities.