# Contract Forms Automation Integration Contract

> **P0 integration-planning deliverable**
>
> This document is the consolidated contract for the Contract Management, Approval
> Workflow and Document Management modules. It separates confirmed requirements,
> proposed technical decisions and items that still require company confirmation.
> It does not imply that the planned endpoints or schema have been implemented.

## 0. Baseline and decisions

### Confirmed baseline

- The backend is the security boundary. Frontend role checks are convenience only.
- PostgreSQL is the structured-data source of truth; Prisma remains pinned at
  **6.19.3**.
- The implemented database currently contains only `User` and the existing
  `UserRole` enum. The initial migration is a connectivity smoke test, not the
  final application schema.
- Vendors do not authenticate or receive application accounts.
- File bytes remain in a private Google Drive. PostgreSQL stores metadata and the
  Drive file ID only.
- Money is represented by PostgreSQL/Prisma `Decimal`, never JavaScript or
  database floating-point values.
- Drafts may be incomplete. Full required-field validation occurs at submission.

### Decisions resolving documentation conflicts

| Conflict | Decision | Reason |
|---|---|---|
| `Attachment` versus `Document` | Use **Attachment** for the database entity and API resource. | The planned database schema and requested P0 entity use `Attachment`; “document” remains a generic description and a file category is not a second entity. |
| `ApprovalStep`/`ApprovalDecision` versus `approvals`/`approval_history` | Use `ApprovalStep` for the ordered current workflow record and `ApprovalDecision` for its append-only decision history. | This matches the requested P0 entities and removes the ambiguity between a step and an event. |
| `UserRole` enum versus `Role` table | Preserve the implemented `UserRole` enum (`ADMIN`, `SUBMITTER`, `APPROVER`); do not add a `Role` table. | It is already implemented, explicitly protected by project rules, and no documented need for dynamic roles exists. |
| PDFMake versus Puppeteer | Use **PDFMake inside Express**. | The project objective and README identify PDFMake as the required implementation. The older architecture/PDF notes mentioning Puppeteer are superseded for this contract; no HTML browser renderer is required. |
| Contract status naming | Use `DRAFT`, `PENDING_APPROVAL`, `RETURNED`, `APPROVED`, `REJECTED`. | These values are already used by the database and workflow documentation and clearly distinguish a returned form from a rejected terminal form. |
| Approval comment requirements | Comments are required for `RETURN` and `REJECT`; optional for `APPROVE` until the company confirms otherwise. | This is the explicit workflow rule and preserves the documented “approve optional” behavior. |
| Proposed fields versus implemented fields | Treat all entities other than `User` and all new `User` relations as proposed. | The current Prisma schema and migration contain no contract, approval, vendor or attachment implementation. |

### Unresolved company questions

The following requirements must be answered before feature implementation can
finalize validation, migrations or UI behavior:

- **CL-01/09:** sample PDF and exact fields, labels, order and requiredness for
  all 14 PDF sections.
- **CL-02/15:** whether approval participation is assignment-only and the exact
  Admin powers.
- **CL-03/04:** number/configuration of approval levels and who assigns them.
- **CL-05:** whether return restarts at level 1 or resumes at the returning level.
- **CL-06/07:** delegation, reassignment, self-approval and rejected-form revival.
- **CL-08:** in-app, email or both notification channels.
- **CL-10:** reference-number format and generator.
- **CL-11:** supported currencies and exchange-rate requirements.
- **CL-12:** evaluation criteria, scoring scale and weighting.
- **CL-13:** Excel columns and whether rows are parsed.
- **CL-14:** file allow-list, size limits and retention.
- **CL-16:** Google account type, ownership and access model.
- **CL-18:** deletion/archive and retention policy.
- **CL-19:** vendor master ownership and creation permissions.
- **CL-20:** password versus company SSO authentication.

## P0.1 Contract field dictionary

### Dictionary conventions

- `Required` means required in a submitted record; `Optional` means it may be
  absent; `Undecided` means the source documents do not establish the rule.
- A draft may omit fields marked required-at-submit.
- `NEEDS CONFIRMATION` is used where a company rule, exact format or field was
  not documented. It is not a default value.
- IDs are UUID strings unless otherwise stated. Timestamps are UTC ISO 8601.
- Decimal values are serialized as strings in JSON (see P0.5).

### ContractForm

| Field | Type | Requiredness | Validation / rule | Owner | Source |
|---|---|---|---|---|---|
| `id` | UUID string | Required | Server-generated, immutable | ContractForm | `05-database-design`, `database-schema` |
| `referenceNo` | string | Undecided | Unique; exact format and generator **NEEDS CONFIRMATION (CL-10)** | ContractForm | `05-database-design` |
| `title` | string | Required at submit | Project/contract title; non-empty after trimming | ContractForm | `05-database-design`, `02-requirements` |
| `sponsorDepartmentId` | UUID string | Required at submit | Must reference an active Department | ContractForm | `05-database-design` |
| `contractCategoryId` | UUID string | Required at submit | Must reference an active ContractCategory | ContractForm | `05-database-design` |
| `scope` | string | Required at submit | Non-empty; maximum length **NEEDS CONFIRMATION (CL-09)** | ContractForm | `02-requirements`, `05-database-design` |
| `procurementRationale` | string | Required at submit | Non-empty; maximum length **NEEDS CONFIRMATION (CL-09)** | ContractForm | `02-requirements`, `05-database-design` |
| `contractAmount` | Decimal string | Required at submit | Non-negative; precision/scale and whether it is estimated or final **NEEDS CONFIRMATION (CL-09/11)** | ContractForm | `05-database-design`, `database-schema` |
| `currencyId` | UUID string | Undecided | Must reference an enabled Currency; supported currencies **NEEDS CONFIRMATION (CL-11)** | ContractForm | `database-schema`, `02-requirements` |
| `recommendedVendorId` | UUID string | Undecided | Must reference a Vendor associated with the form or be rejected; rule **NEEDS CONFIRMATION** | ContractForm | `05-database-design`, `pdf-template-spec` |
| `selectionRationale` | string | Undecided | Required if a recommended vendor exists; exact rule **NEEDS CONFIRMATION (CL-09)** | ContractForm | `05-database-design`, `pdf-template-spec` |
| `status` | ContractStatus | Required | Server-controlled; transitions in P0.5 | ContractForm | `05-database-design`, `07-user-workflow` |
| `createdById` | UUID string | Required | Server sets from authenticated submitter; immutable | ContractForm | `05-database-design` |
| `submittedAt` | UTC timestamp | Optional | Set once on first submission or per confirmed resubmission policy | ContractForm | `05-database-design` |
| `createdAt` | UTC timestamp | Required | Server-generated | ContractForm | `05-database-design` |
| `updatedAt` | UTC timestamp | Required | Server-managed on change | ContractForm | `05-database-design` |

### User, reference data and Vendor

| Entity.field | Type | Requiredness | Validation / rule | Owner | Source |
|---|---|---|---|---|---|
| `User.id` | UUID/string | Required | Existing primary key; immutable | User | `schema.prisma` |
| `User.fullName` | string | Required | Non-empty | User | `schema.prisma` |
| `User.email` | string | Required | Unique; normalized format | User | `schema.prisma`, `database-schema` |
| `User.passwordHash` | string | Required | Hash only; never returned; SSO alternative **NEEDS CONFIRMATION (CL-20)** | User | `schema.prisma`, `12-security-and-rbac` |
| `User.role` | UserRole | Required | Existing enum only: `ADMIN`, `SUBMITTER`, `APPROVER` | User | `schema.prisma`, migration |
| `User.isActive` | boolean | Required | Inactive users cannot authenticate or be assigned new steps | User | `schema.prisma` |
| `User.departmentId` | UUID string | Optional | Department relation; requiredness **NEEDS CONFIRMATION** | User | `05-database-design` |
| `User.createdAt` / `updatedAt` | UTC timestamp | Required | Server-managed | User | `schema.prisma` |
| `Department.id` | UUID | Required | Server-generated | Department | `05-database-design` |
| `Department.name` | string | Required | Unique, non-empty | Department | `05-database-design` |
| `ContractCategory.id` | UUID | Required | Server-generated | ContractCategory | `05-database-design` |
| `ContractCategory.name` | string | Required | Unique, non-empty | ContractCategory | `05-database-design` |
| `VendorType.id` | UUID | Required | Server-generated | VendorType | `05-database-design` |
| `VendorType.name` | string | Required | Unique, non-empty; managed by Admin or other owner **NEEDS CONFIRMATION (CL-19)** | VendorType | `05-database-design` |
| `Vendor.id` | UUID | Required | Server-generated | Vendor | `05-database-design` |
| `Vendor.name` | string | Required | Non-empty | Vendor | `05-database-design` |
| `Vendor.vendorTypeId` | UUID | Required | Must reference VendorType | Vendor | `05-database-design` |
| `Vendor.contactDetails` | JSON/object | Optional | Shape and fields **NEEDS CONFIRMATION (CL-09)**; do not expose secrets | Vendor | `05-database-design` |
| `Vendor.createdAt` | UTC timestamp | Required | Server-generated | Vendor | `05-database-design` |
| `Currency.id` | UUID | Required | Server-generated | Currency | `database-schema` |
| `Currency.code` | string | Required | ISO/code convention and supported list **NEEDS CONFIRMATION (CL-11)** | Currency | `database-schema` |
| `Currency.name` | string | Required | Non-empty | Currency | `database-schema` |

### Bidder, Quotation, Evaluation and CostLine

| Entity.field | Type | Requiredness | Validation / rule | Owner | Source |
|---|---|---|---|---|---|
| `Bidder.id` | UUID | Required | Server-generated | Bidder | `05-database-design` |
| `Bidder.contractFormId` | UUID | Required | Parent ContractForm; immutable | Bidder | `05-database-design` |
| `Bidder.vendorId` | UUID | Required | Must reference Vendor | Bidder | `05-database-design` |
| `Bidder.sortOrder` | integer | Required | Unique within form; non-negative | Bidder | `05-database-design` |
| `Quotation.id` | UUID | Required | Server-generated | Quotation | `05-database-design` |
| `Quotation.bidderId` | UUID | Required | Must reference Bidder in the same form | Quotation | `05-database-design` |
| `Quotation.quotedAmount` | Decimal string | Required | Non-negative; precision/scale **NEEDS CONFIRMATION (CL-11)** | Quotation | `05-database-design` |
| `Quotation.currencyId` | UUID | Undecided | Must reference Currency; exchange-rate behavior **NEEDS CONFIRMATION (CL-11)** | Quotation | `05-database-design` |
| `Quotation.quotationDate` | date | Undecided | ISO date; requiredness **NEEDS CONFIRMATION (CL-09)** | Quotation | `05-database-design` |
| `Quotation.notes` | string | Optional | Maximum length **NEEDS CONFIRMATION** | Quotation | `05-database-design` |
| `Evaluation.id` | UUID | Required | Server-generated | Evaluation | `05-database-design` |
| `Evaluation.contractFormId` | UUID | Required | Parent ContractForm | Evaluation | `05-database-design` |
| `Evaluation.bidderId` | UUID | Required | Must reference Bidder in the same form | Evaluation | `05-database-design` |
| `Evaluation.type` | EvaluationType | Required | `TECHNICAL` or `COMMERCIAL` | Evaluation | `05-database-design` |
| `Evaluation.score` | Decimal string | Undecided | Scale, precision and weighting **NEEDS CONFIRMATION (CL-12)** | Evaluation | `05-database-design`, `02-requirements` |
| `Evaluation.remarks` | string | Required at submit | Non-empty for a completed evaluation; exact rule **NEEDS CONFIRMATION (CL-12)** | Evaluation | `05-database-design` |
| `Evaluation.evaluatedById` | UUID | Undecided | Must reference User; evaluator permission **NEEDS CONFIRMATION (CL-12)** | Evaluation | `05-database-design` |
| `CostLine.id` | UUID | Required | Server-generated | CostLine | `database-schema` |
| `CostLine.contractFormId` | UUID | Required | Parent ContractForm | CostLine | `database-schema` |
| `CostLine.description` | string | Required at submit | Non-empty | CostLine | `05-database-design` |
| `CostLine.quantity` | Decimal string | Undecided | Non-negative; precision/scale **NEEDS CONFIRMATION (CL-09)** | CostLine | `05-database-design` |
| `CostLine.unitCost` | Decimal string | Undecided | Non-negative; Decimal | CostLine | `05-database-design` |
| `CostLine.amount` | Decimal string | Required | Decimal; calculation/rounding rule **NEEDS CONFIRMATION** | CostLine | `05-database-design`, `database-schema` |
| `CostLine.sortOrder` | integer | Required | Unique within form; non-negative | CostLine | `05-database-design` |

### Attachment and approval-related information

| Entity.field | Type | Requiredness | Validation / rule | Owner | Source |
|---|---|---|---|---|---|
| `Attachment.id` | UUID | Required | Server-generated | Attachment | `database-schema` |
| `Attachment.contractFormId` | UUID | Required | Parent ContractForm | Attachment | `database-schema` |
| `Attachment.category` | AttachmentCategory | Required | `SUPPORTING`, `COST_ESTIMATE_EXCEL`, or `GENERATED_PDF` | Attachment | `05-database-design`, `database-schema` |
| `Attachment.fileName` | string | Required | Sanitized display name; original path never trusted | Attachment | `05-database-design`, `12-security-and-rbac` |
| `Attachment.mimeType` | string | Required | Must match the approved file allow-list; allow-list **NEEDS CONFIRMATION (CL-14)** | Attachment | `05-database-design` |
| `Attachment.sizeBytes` | integer | Required | Positive and within configured limit **NEEDS CONFIRMATION (CL-14)** | Attachment | `05-database-design` |
| `Attachment.driveFileId` | string | Required | Private Drive ID; never exposed as a direct public link | Attachment | `09-google-drive-integration` |
| `Attachment.uploadedById` | UUID | Required | Authenticated User; generated PDFs use the generating actor/system policy **NEEDS CONFIRMATION** | Attachment | `05-database-design` |
| `Attachment.createdAt` | UTC timestamp | Required | Server-generated | Attachment | `05-database-design` |
| `ApprovalStep.id` | UUID | Required | Server-generated | ApprovalStep | `08-approval-workflow`, `database-schema` |
| `ApprovalStep.contractFormId` | UUID | Required | Parent ContractForm | ApprovalStep | `05-database-design` |
| `ApprovalStep.level` | integer | Required | Positive, unique per form, sequential | ApprovalStep | `05-database-design` |
| `ApprovalStep.approverId` | UUID | Required | Active User; assigned approver only | ApprovalStep | `05-database-design` |
| `ApprovalStep.status` | ApprovalStatus | Required | One current step `PENDING`; later steps `WAITING` | ApprovalStep | `08-approval-workflow` |
| `ApprovalStep.actedAt` | UTC timestamp | Optional | Set only when decided | ApprovalStep | `05-database-design` |
| `ApprovalDecision.id` | UUID | Required | Server-generated, append-only | ApprovalDecision | `database-schema` |
| `ApprovalDecision.approvalStepId` | UUID | Required | Parent step | ApprovalDecision | `08-approval-workflow` |
| `ApprovalDecision.contractFormId` | UUID | Required | Denormalized parent for audit/query consistency | ApprovalDecision | `05-database-design` |
| `ApprovalDecision.actorId` | UUID | Required | Must equal the assigned current approver for workflow actions | ApprovalDecision | `08-approval-workflow` |
| `ApprovalDecision.decision` | ApprovalDecisionValue | Required | `APPROVED`, `RETURNED`, or `REJECTED` | ApprovalDecision | `08-approval-workflow` |
| `ApprovalDecision.comment` | string | Conditional | Required for `RETURN`/`REJECT`; optional for `APPROVE` | ApprovalDecision | `08-approval-workflow` |
| `ApprovalDecision.createdAt` | UTC timestamp | Required | Server-generated | ApprovalDecision | `08-approval-workflow` |
| `AuditLog.id` | UUID | Required | Server-generated, append-only | AuditLog | `05-database-design` |
| `AuditLog.actorId` | UUID | Required | Authenticated actor; system policy **NEEDS CONFIRMATION** | AuditLog | `05-database-design` |
| `AuditLog.action` | string/enum | Required | Controlled action name; final list **NEEDS CONFIRMATION** | AuditLog | `12-security-and-rbac` |
| `AuditLog.entityType` | string/enum | Required | Entity being changed/read | AuditLog | `05-database-design` |
| `AuditLog.entityId` | UUID/string | Required | Identifier of entity | AuditLog | `05-database-design` |
| `AuditLog.contractFormId` | UUID | Optional | Set when event concerns a form | AuditLog | `05-database-design` |
| `AuditLog.details` | JSON object | Optional | Structured metadata; no secrets or file bytes | AuditLog | `05-database-design` |
| `AuditLog.createdAt` | UTC timestamp | Required | Server-generated | AuditLog | `05-database-design` |
| `Notification.id` | UUID | Required | Server-generated | Notification | `05-database-design` |
| `Notification.recipientId` | UUID | Required | User recipient; vendors excluded | Notification | `05-database-design` |
| `Notification.contractFormId` | UUID | Required | Related ContractForm | Notification | `05-database-design` |
| `Notification.message` | string | Required | Server-generated, non-empty | Notification | `05-database-design` |
| `Notification.isRead` | boolean | Required | Defaults false; only recipient can mark read | Notification | `05-database-design` |
| `Notification.createdAt` | UTC timestamp | Required | Server-generated | Notification | `05-database-design` |
| `Notification.channel` | string/enum | Undecided | In-app at minimum; email **NEEDS CONFIRMATION (CL-08)** | Notification | `08-approval-workflow` |

## P0.2 Shared enums and constants

These are the canonical wire, validation and database values. Frontend,
backend, Prisma and API documentation must use the same uppercase strings.

| Name | Exact values | Notes |
|---|---|---|
| `UserRole` | `ADMIN`, `SUBMITTER`, `APPROVER` | Preserve existing Prisma enum. `APPROVER` is an assignment-capable user role; it is not a separate Role table. |
| `ContractStatus` | `DRAFT`, `PENDING_APPROVAL`, `RETURNED`, `APPROVED`, `REJECTED` | `APPROVED` and `REJECTED` are terminal under current assumptions. |
| `ApprovalStatus` | `WAITING`, `PENDING`, `APPROVED`, `RETURNED`, `REJECTED` | Applies to an `ApprovalStep`; only one step per form may be `PENDING`. |
| `ApprovalDecisionValue` | `APPROVED`, `RETURNED`, `REJECTED` | Stored outcome value; endpoint verbs are `approve`, `return` and `reject`. |
| `AttachmentCategory` | `SUPPORTING`, `COST_ESTIMATE_EXCEL`, `GENERATED_PDF` | `GENERATED_PDF` is created by PDF generation; the other categories are uploaded. |
| `EvaluationType` | `TECHNICAL`, `COMMERCIAL` | One or more records per bidder/type depending on CL-12; cardinality must be confirmed. |

Constants:

- API prefix: `/api`.
- Authentication cookie: `contract_token` (existing backend convention).
- JSON content type for regular requests and responses.
- Default page size: `20`; maximum page size: **NEEDS CONFIRMATION**, proposed `100`.
- Decimal JSON representation: quoted base-10 string, e.g. `"12500.00"`.
- Date-time: UTC ISO 8601 with `Z`, e.g. `"2026-11-16T10:51:51.287Z"`.
- Date-only: ISO 8601 `YYYY-MM-DD`.
- Google Drive: private files, backend-mediated access only.

## P0.3 Proposed relational design

### Tables and keys

| Table | Primary key | Required foreign keys | Important constraints |
|---|---|---|---|
| `User` | `id` | `departmentId` optional | Unique `email`; existing `UserRole`; no `Role` table |
| `Department` | `id` | none | Unique `name` |
| `ContractCategory` | `id` | none | Unique `name` |
| `VendorType` | `id` | none | Unique `name` |
| `Currency` | `id` | none | Unique `code` |
| `Vendor` | `id` | `vendorTypeId` | Vendor has no login credentials |
| `ContractForm` | `id` | `createdById`, `sponsorDepartmentId`, `contractCategoryId`; `currencyId` and `recommendedVendorId` optional | Index `(status, createdById)`, department, created date; reference number unique when present |
| `Bidder` | `id` | `contractFormId`, `vendorId` | Unique `(contractFormId, sortOrder)` |
| `Quotation` | `id` | `bidderId`; `currencyId` optional | Decimal `quotedAmount` |
| `Evaluation` | `id` | `contractFormId`, `bidderId`; `evaluatedById` optional | Type enum; same-form bidder constraint |
| `CostLine` | `id` | `contractFormId` | Decimal quantity/unit cost/amount; unique sort order per form |
| `Attachment` | `id` | `contractFormId`, `uploadedById` | Drive ID unique; no bytes in DB |
| `ApprovalStep` | `id` | `contractFormId`, `approverId` | Unique `(contractFormId, level)`; indexed approver/status |
| `ApprovalDecision` | `id` | `approvalStepId`, `contractFormId`, `actorId` | Append-only; decision/comment/timestamp |
| `AuditLog` | `id` | `actorId`; `contractFormId` optional | Append-only; indexed entity and form |
| `Notification` | `id` | `recipientId`, `contractFormId` | Indexed recipient/read/created date |

### Relationships and delete behavior

- `Department 1:N User` and `Department 1:N ContractForm`.
- `ContractCategory 1:N ContractForm`.
- `VendorType 1:N Vendor`.
- `User 1:N ContractForm` through `createdById`.
- `Vendor 1:N ContractForm` through optional `recommendedVendorId`.
- `ContractForm 1:N Bidder`, `CostLine`, `Attachment`, `ApprovalStep`,
  `ApprovalDecision`, `AuditLog` and `Notification`.
- `Vendor 1:N Bidder`; `Bidder 1:N Quotation` and `Evaluation`.
- `ContractForm 1:N Evaluation`; each evaluation also belongs to one Bidder.
- `User 1:N ApprovalStep` through `approverId`; `ApprovalStep 1:N
  ApprovalDecision`.
- `User 1:N Attachment`, `AuditLog` and `Notification` through their actor,
  uploader or recipient foreign keys.
- `Currency 1:N ContractForm` and `Quotation`.
- Required parent relations use `RESTRICT` on delete. Contract forms are not
  physically deleted by normal workflow; archive/retention is **NEEDS
  CONFIRMATION (CL-18)**.
- Child rows that have no independent meaning (`Bidder`, `Quotation`,
  `Evaluation`, `CostLine`, `Attachment`, `ApprovalStep`, `ApprovalDecision`,
  `Notification`) may use parent cascade only if the company approves physical
  form deletion. Until then, use restricted deletion and status-based closure.
- `AuditLog` and `ApprovalDecision` are never updated or deleted through the API.
- Removing a draft attachment may remove its Drive file and metadata together,
  subject to CL-14. Generated PDFs are versioned, not overwritten.

### Ownership and approval invariants

1. A `ContractForm` is the parent of all bidders, cost lines, attachments and
   approval records for that form.
2. The creator owns draft/returned edits. An approver may view, but not edit,
   form content.
3. Only the assigned approver of the current `PENDING` step may decide.
4. A transaction must re-check the step is still `PENDING` before recording a
   decision, preventing duplicate concurrent actions.
5. Only one step per form is `PENDING`; subsequent steps are `WAITING`.
6. Every approval action creates both an append-only `ApprovalDecision` and an
   `AuditLog` entry.

## P0.4 API contracts

### Common API shape

Base path is `/api`. All listed endpoints require a valid JWT in the HttpOnly
`contract_token` cookie. The backend performs role, ownership and assigned-step
checks; a UI check is never sufficient.

Success:

```json
{
  "success": true,
  "message": "Contract created",
  "data": { "id": "uuid", "status": "DRAFT" },
  "meta": { "requestId": "uuid" }
}
```

List success uses `data.items` and `meta.pagination`:

```json
{
  "success": true,
  "message": "Contracts retrieved",
  "data": { "items": [] },
  "meta": { "pagination": { "page": 1, "pageSize": 20, "totalItems": 0, "totalPages": 0 } }
}
```

Error:

```json
{
  "success": false,
  "message": "Validation failed",
  "error": { "code": "VALIDATION_ERROR", "details": [
    { "path": "title", "message": "Required" }
  ] },
  "meta": { "requestId": "uuid" }
}
```

### Contract management

| Operation | Method and URL | Access |
|---|---|---|
| Create draft | `POST /api/forms` | Authenticated `SUBMITTER` or `ADMIN`; creator ownership applies |
| Update draft/returned | `PATCH /api/forms/:id` | Creator; Admin only if CL-15 permits |
| Get details | `GET /api/forms/:id` | Creator, assigned/past approver, or Admin |
| List contracts | `GET /api/forms` | Creator sees own; Admin sees all; filters below |
| Submit | `POST /api/forms/:id/submit` | Creator; Admin only if confirmed |

Create/update request properties:

```json
{
  "title": "string",
  "sponsorDepartmentId": "uuid",
  "contractCategoryId": "uuid",
  "scope": "string",
  "procurementRationale": "string",
  "contractAmount": "12500.00",
  "currencyId": "uuid",
  "recommendedVendorId": "uuid",
  "selectionRationale": "string"
}
```

`POST /forms` creates `DRAFT`; `PATCH` allows only editable fields and does not
accept `status`, `createdById`, approval fields or audit fields. Nested bidder,
quotation, evaluation and cost-line writes use their own module contracts.

`POST /forms/:id/submit` has body `{}`. The server validates all required
submitted fields, verifies the approval chain exists, changes status to
`PENDING_APPROVAL`, creates/activates the first `ApprovalStep`, records a
`SUBMITTED` audit/history event and notifies the first approver. A resubmission
uses the same endpoint from `RETURNED`; restart/resume behavior is CL-05.

Detail response `data` contains the form, creator, department, category,
vendor, bidders with quotations, evaluations, cost lines, attachments
(metadata only), approval steps/decisions and audit/history entries. Password
hashes and direct Drive links are never returned.

List query properties:

`page`, `pageSize`, `status`, `departmentId`, `contractCategoryId`,
`recommendedVendorId`, `q`, `from`, `to`. `q` searches the documented
identifier/title fields; exact searchable fields are **NEEDS CONFIRMATION**.
Dates are inclusive UTC date boundaries. Unknown filters fail validation.

Possible errors: `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`,
`403 FORBIDDEN`, `404 FORM_NOT_FOUND`, `409 INVALID_STATE` or duplicate
reference, `500 INTERNAL_ERROR`.

### Approval workflow

| Operation | Method and URL | Access |
|---|---|---|
| List assigned approvals | `GET /api/approvals/pending` | Authenticated `APPROVER`; current assigned `PENDING` steps only |
| Get approval details | `GET /api/approvals/:id` | Assigned approver, form creator for their form, or Admin |
| Approve | `POST /api/approvals/:id/approve` | Assigned current approver only |
| Return for changes | `POST /api/approvals/:id/return` | Assigned current approver only |
| Reject | `POST /api/approvals/:id/reject` | Assigned current approver only |

Approve/return/reject request:

```json
{ "comment": "string" }
```

`comment` is optional for approve and required, non-empty after trimming, for
return and reject. The response returns the updated step, form status,
decision and next-step summary. Approve activates the next step or marks the
form `APPROVED`; return marks the form `RETURNED`; reject marks it `REJECTED`.
Every action is transactional and writes the decision, audit event and
notification effects.

Possible errors: `400 VALIDATION_ERROR`, `401 AUTHENTICATION_REQUIRED`,
`403 NOT_ASSIGNED_APPROVER`, `404 APPROVAL_NOT_FOUND`, `409 STEP_NOT_PENDING`
or `INVALID_STATE`, `500 INTERNAL_ERROR`.

### Document management

| Operation | Method and URL | Access |
|---|---|---|
| Upload attachment | `POST /api/forms/:id/attachments` | Form creator on editable form; Admin only if confirmed |
| List attachments | `GET /api/forms/:id/attachments` | Creator, approver with access, or Admin |
| Download/view attachment | `GET /api/attachments/:id/download` | Same authorized users; backend streams Drive content |
| Generate final PDF | `POST /api/forms/:id/pdf` | Authorized user; eligibility must be confirmed, proposed `APPROVED` only |
| Retrieve generated PDF | `GET /api/forms/:id/pdf` | Creator, approver with access, or Admin |

Upload is multipart with one file and a `category` property. Allowed categories
are `SUPPORTING` and `COST_ESTIMATE_EXCEL`; `GENERATED_PDF` is server-only.
The backend validates MIME type, size, sanitized name and form status before
uploading. The response contains attachment metadata, never file bytes or a
public Drive URL.

PDF generation loads saved data, renders with PDFMake in Express, uploads a new
private `GENERATED_PDF` Attachment, and returns its metadata. Generated PDFs are
versioned. Retrieval streams the latest eligible generated PDF through the
backend after authorization.

Possible errors: `400 VALIDATION_ERROR` or `UNSUPPORTED_FILE`,
`401 AUTHENTICATION_REQUIRED`, `403 FORBIDDEN`, `404 ATTACHMENT_NOT_FOUND` or
`PDF_NOT_FOUND`, `409 INVALID_STATE`, `413 FILE_TOO_LARGE`, `502 DRIVE_ERROR`
or `PDF_GENERATION_FAILED`, `500 INTERNAL_ERROR`.

## P0.5 Common backend conventions

### Validation and errors

- Every body, path parameter, query parameter and multipart metadata is
  validated by a server-side Zod schema.
- Schemas reject unknown keys for mutation requests and whitelist assignable
  fields; clients cannot mass-assign status, owner, timestamps, role or Drive
  IDs.
- Validation errors return `400` with code `VALIDATION_ERROR` and path-level
  details.
- `401` means no valid authentication; `403` means authenticated but not
  authorized; `404` does not reveal unauthorized resource existence; `409`
  means a valid request conflicts with current state or uniqueness; `413`
  means file too large; `502` means the Drive/PDF dependency failed.
- Unexpected errors return the standard envelope with `500 INTERNAL_ERROR`,
  a request ID and no stack trace or secret.

### Dates, money, pagination and filtering

- Persist timestamps as PostgreSQL timestamps and serialize UTC ISO 8601 with
  `Z`. Date-only business values use `YYYY-MM-DD`; no server-local timezone is
  implied.
- Persist every monetary field as Prisma `Decimal` with an agreed precision and
  scale. The exact precision/scale is **NEEDS CONFIRMATION**. JSON uses strings
  so precision is not lost.
- Pagination is one-based: `page` defaults to `1`, `pageSize` defaults to `20`,
  and values above the configured maximum are rejected. Responses always include
  total counts and pages.
- Filters use explicit IDs and enum values. `from`/`to` are UTC date boundaries.
  Search is case-insensitive only over explicitly documented fields.

### Authentication, authorization and ownership

- JWT is carried in the HttpOnly `contract_token` cookie; secrets are
  environment-only. Authentication must load the current User and role rather
  than trusting a client-supplied role.
- Inactive users are denied authentication and cannot be assigned.
- `SUBMITTER` creates and edits own `DRAFT`/`RETURNED` forms. `APPROVER` views
  forms in which they are an assigned current/past approver and decides only
  on their current `PENDING` step. `ADMIN` has wider visibility and reference
  management; exact form overrides remain CL-15.
- Vendors never authenticate. Attachment downloads and PDF retrieval are
  backend-authorized and Drive-mediated.
- Ownership and assigned-approver checks run after authentication and before
  service/database access. Related resources inherit the parent form
  authorization.

### Status transitions

```text
DRAFT -> PENDING_APPROVAL       submit
RETURNED -> PENDING_APPROVAL     resubmit
PENDING_APPROVAL -> RETURNED     approver return
PENDING_APPROVAL -> REJECTED     approver reject
PENDING_APPROVAL -> APPROVED     final approver approve
PENDING_APPROVAL -> PENDING_APPROVAL  non-final approver approve (next step)
```

No other transitions are allowed. Draft/returned forms are editable by the
owner; pending, approved and rejected forms are read-only to the creator.
Whether rejected forms can be revived and whether return restarts or resumes
the chain remain CL-05/CL-07.

### Audit and integration reliability

- Create, update, submit/resubmit, status changes, approval decisions,
  attachment upload/download, PDF generation, login and Admin changes write
  audit entries.
- Approval transitions and their audit/notification effects use a database
  transaction. Drive uploads use compensating cleanup: no metadata row on
  upload failure; an orphan Drive file is removed if the metadata transaction
  fails.
- Direct Drive links, credentials, password hashes, file contents and
  sensitive request data are never logged or returned.

## Implementation readiness checklist

Before feature development starts, the team must:

1. Confirm all CL items listed above, especially required form fields, approval
   rules, currencies, file policy and PDF sample.
2. Approve this enum set and relational naming.
3. Add the proposed schema in a future Prisma change while retaining the
   existing `UserRole` enum and Prisma `6.19.3`.
4. Keep this document, `database-er.mmd`, Zod schemas and route contracts
   synchronized; do not create a second integration contract.

