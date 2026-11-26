# 02. Requirements

## A. Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-01 | User and Admin authentication. | Implemented |
| FR-02 | Backend-enforced role-based access control (RBAC). | Implemented |
| FR-03 | Create and edit contract forms. | Implemented |
| FR-04 | Save incomplete forms as drafts. | Implemented |
| FR-05 | Dashboard showing totals for all, draft, pending approval, approved, and rejected/returned forms. | Implemented |
| FR-06 | Searchable and filterable contract register. | Implemented |
| FR-07 | Capture project, sponsor department, contract category, scope, and procurement rationale. | Implemented |
| FR-08 | Vendor details with vendor type autocomplete. | Implemented |
| FR-09 | Repeatable bidder details and quotation records. | Implemented |
| FR-10 | Technical and commercial evaluations. | Implemented |
| FR-11 | Cost estimate breakdowns and Excel estimate uploads. | Implemented |
| FR-12 | Sequential approval workflow. | Implemented |
| FR-13 | Approve, return, and reject actions with comments. | Implemented |
| FR-14 | Approval history and audit trail. | Implemented |
| FR-15 | Notifications to the next approval participant. | Implemented |
| FR-16 | Supporting document uploads. | Implemented |
| FR-17 | Google Drive storage for supporting documents and generated PDFs. | Implemented |
| FR-18 | PDF generation following the contract form structure. | Implemented |
| FR-19 | Authorized viewing and downloading of documents. | Implemented |
| FR-20 | Azure deployment and deployment documentation. | Implemented |

## B. Technical Requirements

| Area | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express.js, TypeScript, REST APIs |
| Database | PostgreSQL with Prisma ORM |
| Validation / Forms | Zod, React Hook Form |
| Authentication | JWT-based authentication using secure HttpOnly cookies |
| Password Security | bcrypt |
| File Storage | Google Drive API v3 |
| PDF Generation | PDFMake |
| Infrastructure | Microsoft Azure |
| Testing | Vitest and Supertest |

The application follows a frontend/backend separation. Database access, authentication, authorization, file operations, and business logic are handled by the backend.

## C. Clarification and Implementation Decisions

The following items were identified during requirements analysis. Their current implementation decisions are documented below.

| ID | Requirement / Clarification | Current Decision |
|---|---|---|
| CL-01 | Sample contract form PDF and visual layout. | The generated PDF follows the documented 14-section contract structure. The company sample should be used as the final visual reference wherever available. |
| CL-02 | Whether Approver is a separate role. | Resolved: `APPROVER` is a separate application role, alongside `ADMIN` and `SUBMITTER`. |
| CL-03 | Number of approval levels and whether they are configurable. | Sequential approval workflow is implemented. Exact company-wide approval-level configuration should be verified against the configured workflow. |
| CL-04 | Who approves at each level and who assigns approvers. | Approval is handled through assigned approval steps. Exact organizational assignment policy depends on the configured approvers. |
| CL-05 | Whether returned forms restart approval from level 1 or resume at the returning level. | Resolved: Resubmission follows the restart rule defined by CL-05 in the approval workflow implementation. |
| CL-06 | Reassignment, delegation, and self-approval rules. | Follow the authorization and approval rules enforced by the application. Any additional company-specific delegation policy requires confirmation. |
| CL-07 | Whether rejection is final. | Resolved: Rejected contracts are closed and treated as terminal workflow records. |
| CL-08 | Notification channel. | Notifications are part of the approval workflow. The exact notification channels should be verified against the active implementation. |
| CL-09 | Required and optional fields across the 14 contract sections. | Form validation is based on the configured form schema and applicable required-field rules. |
| CL-10 | Contract reference/number format. | Contract references are maintained with the contract record. The exact company numbering convention should be verified against the implementation. |
| CL-11 | Supported currencies and exchange rates. | Currency information is maintained through the application's currency data. Exchange-rate requirements depend on the business rules. |
| CL-12 | Technical/commercial evaluation criteria, scoring scale, and weighting. | Evaluation information is captured in the contract workflow. Any organization-specific scoring policy should follow the configured evaluation rules. |
| CL-13 | Excel cost estimate template and import behavior. | Resolved: Excel template contains Description, Quantity, and Unit Cost columns. Import validates and appends up to 500 cost rows, calculating Amount as Quantity × Unit Cost. Manual cost entry is also supported. |
| CL-14 | Supported file types, upload limits, and retention. | Resolved: PDF, Excel, CSV, Word, PNG/JPEG, and TXT files are supported. Maximum file size is 10 MiB per file, with up to 5 files per upload. Contract records, approval history, and uploads are retained for the contract lifetime. Audit logs are retained for at least 7 years. No automatic deletion is performed. Authorized deletion is audited. |
| CL-15 | Admin permissions over contract forms. | Admin has wider application visibility and administrative access. Form actions remain subject to backend authorization rules. |
| CL-16 | Google Drive account and access scope. | Resolved: Personal Google My Drive using OAuth with the `drive.file` scope and an application-created root folder. Broad Drive access is not required. |
| CL-17 | Azure subscription, region, credits, expiry, and budget limits. | Azure infrastructure is used for deployment. Subscription-specific credit balances, expiry dates, and budget limits are environment-dependent. |
| CL-18 | Automatic deletion and record retention. | Resolved: Contracts, approval records, audit logs, and documents are not automatically deleted. Authorized deletion requires administrative authorization and an audit record. |
| CL-19 | Vendor master data management. | Vendor and vendor-type information is managed through application data and administrative functionality. |
| CL-20 | Authentication method. | Resolved: Email/password authentication with JWT-based sessions and secure HttpOnly cookies. Passwords are hashed using bcrypt. |

## D. Business Rules and Assumptions

The following rules describe the application's workflow behavior:

- **A-01 — Authentication:** Users authenticate using email and password.
- **A-02 — Approval sequence:** Contracts follow the configured sequential approval workflow.
- **A-03 — Form editing:** Submitters can edit forms while they are in Draft or Returned status. Submitted forms are read-only to the submitter during approval.
- **A-04 — Terminal states:** Approved and Rejected are treated as completed workflow states.
- **A-05 — PDF generation:** PDFs are generated by the backend using persisted contract data rather than relying on frontend-rendered content.
- **A-06 — Document authorization:** Google Drive files are private. Users must pass backend authorization checks before viewing or downloading documents.
- **A-07 — Form versioning:** Contract forms retain their associated published form schema version so that later configuration changes do not alter previously created forms.
- **A-08 — Auditability:** Important contract and approval actions are recorded for traceability.

## E. Out of Scope

The following features are outside the current project scope:

- Payment processing.
- Electronic signatures.
- Contract renewal and expiry tracking.
- External vendor portals.
- Advanced analytics beyond the implemented dashboard and contract register.
- Features unrelated to the defined contract form and approval workflow.

Any additional functionality requires separate scope approval.