# 10. PDF Generation

> **Status:** Planned (Phase 4). **The company's sample contract form PDF has not been provided and is REQUIRED before the exact layout, field order, labels and styling can be finalized.** This document does not define the layout.

## Approach
1. A user or the system triggers `POST /forms/:id/pdf` for an eligible form (eligibility rule to confirm, e.g. approved forms only).
2. The `pdf` module loads form data (and related records) from PostgreSQL.
3. Data is merged into an HTML template (server-side).
4. Puppeteer renders the HTML to PDF.
5. The PDF is uploaded to Google Drive and a `GENERATED_PDF` document record is saved.
6. An audit log entry is written.
Because it is generated from stored data, the PDF always reflects the database state at generation time.

## Required Sections (14)
| # | Section | Expected data source |
|---|---|---|
| 1 | Contract/Project Identification | `contract_forms` |
| 2 | Sponsor Department | `departments` |
| 3 | Contract Category and Scope | `contract_categories`, form scope |
| 4 | Procurement/Sourcing Rationale | form rationale |
| 5 | Vendor/Contractor Details | `vendors`, `vendor_types` |
| 6 | Contract Amount and Currency | form amount, currency |
| 7 | Budget and Cost Estimate | `cost_estimate_items` |
| 8 | Bidders and Quotations | `bidders`, `quotations` |
| 9 | Technical Evaluation | `evaluations` (TECHNICAL) |
| 10 | Commercial Evaluation | `evaluations` (COMMERCIAL) |
| 11 | Recommended Vendor and Selection Rationale | form recommended vendor, rationale |
| 12 | Supporting Documents | `documents` (names/metadata list) |
| 13 | Approval History | `approval_history` |
| 14 | Audit/Record Information | `audit_logs`, timestamps, record IDs |

## Technical Notes
- Templates live in `backend/src/modules/pdf/templates/` (to be created in Phase 4).
- Puppeteer needs Chromium on the Azure host; see [11-azure-deployment.md](11-azure-deployment.md). Resource limits (memory, timeouts) must be tested.
- Generation runs with a timeout and returns a clear error on failure.
- Page size, fonts, headers/footers, logos: **pending sample PDF**.

## Blocking Item
CL-01: obtain the sample PDF. Until then only data mapping (above) is planned.
