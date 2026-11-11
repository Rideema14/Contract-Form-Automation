# 02. Requirements

## A. Confirmed Functional Requirements
| ID | Requirement |
|---|---|
| FR-01 | User and Admin authentication. |
| FR-02 | Role-based access control (RBAC) enforced by the backend. |
| FR-03 | Create and edit contract forms. |
| FR-04 | Save incomplete forms as drafts. |
| FR-05 | Dashboard showing totals for: all, draft, pending approval, approved, and rejected/returned forms. |
| FR-06 | Searchable and filterable contract register. |
| FR-07 | Capture project, sponsor department, contract category, scope and procurement rationale. |
| FR-08 | Vendor details with vendor type autocomplete. |
| FR-09 | Repeatable bidder details and quotation records. |
| FR-10 | Technical and commercial evaluations. |
| FR-11 | Cost estimate breakdowns and Excel estimate uploads. |
| FR-12 | Sequential approval workflow. |
| FR-13 | Approve, return and reject actions, each with comments. |
| FR-14 | Approval history and audit trail. |
| FR-15 | Notifications to the next approval participant. |
| FR-16 | Supporting document uploads. |
| FR-17 | Google Drive storage for supporting documents and generated PDFs. |
| FR-18 | PDF generation following the company's sample contract form. |
| FR-19 | Authorized viewing and downloading of documents. |
| FR-20 | Azure deployment and deployment documentation. |

## B. Confirmed Technical Requirements
| Area | Technology |
|---|---|
| Frontend | Next.js, React, JavaScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express.js, REST APIs |
| Database | PostgreSQL with Prisma ORM |
| Validation / forms | Zod, React Hook Form |
| Integrations | Google Drive API, Puppeteer, Microsoft Azure |

No substitutions or unnecessary libraries without a documented technical reason.

## C. Items Requiring Company Clarification
| ID | Question | Affects |
|---|---|---|
| CL-01 | **Sample contract form PDF**: the layout is required before PDF work is finalized. | Phase 4, doc 10 |
| CL-02 | Is "Approver" a separate role, or an assignment of User/Admin? | RBAC, approvals |
| CL-03 | How many approval levels exist? Fixed or configurable per form (amount, category, department)? | Approvals |
| CL-04 | Who approves at each level, and who assigns approvers? | Approvals |
| CL-05 | After a **return**, does resubmission restart at level 1 or resume at the returning level? | Approvals |
| CL-06 | Can an approver reassign or delegate? Can a creator approve their own form? | Approvals, RBAC |
| CL-07 | Is **reject** final (terminal), or can a rejected form be revived/copied? | Approvals |
| CL-08 | Notification channel: in-app only, email, or both? | Notifications |
| CL-09 | Exact form fields for each of the 14 PDF sections and their mandatory/optional status. | Forms, PDF |
| CL-10 | Contract reference/number format and who generates it. | Forms |
| CL-11 | Currencies supported and whether exchange rates are needed. | Forms, amounts |
| CL-12 | Technical/commercial evaluation criteria, scoring scale and weighting. | Evaluations |
| CL-13 | Excel estimate template: required columns, and whether rows are parsed into the cost breakdown or stored only as a file. | Cost estimates |
| CL-14 | Allowed file types, maximum sizes and retention period for documents. | Documents |
| CL-15 | Which Admin permissions apply to forms (view all, edit, delete, override)? | RBAC |
| CL-16 | Google Drive account type (Workspace vs personal), folder ownership, and access model. | Phase 3 |
| CL-17 | Azure subscription, region, credit amount, credit expiry date and budget limits. | Phase 2 |
| CL-18 | Are forms ever deleted, or only archived? Data retention policy. | Database, audit |
| CL-19 | Vendor master list: pre-loaded, or created on the fly? Who may add vendor types? | Vendors |
| CL-20 | Authentication method: email/password, or company SSO? Password policy. | Auth |

## D. Assumptions (to be validated)
- A-01: Email + password authentication with JWT-based sessions unless CL-20 says otherwise.
- A-02: Approvals are linear (one approver per level, in order).
- A-03: A form is editable only while in Draft or Returned status.
- A-04: Rejected and Approved are terminal states.
- A-05: The PDF is generated from stored data, not from the UI.

## E. Out of Scope
Anything not listed in Sections A and B, including payments, e-signature, contract renewal tracking, vendor portals, and analytics beyond the dashboard counts.
