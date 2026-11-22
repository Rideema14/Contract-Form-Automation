# 10. PDF Generation

> **Implementation status:** PDFMake generation and private Drive storage are implemented. The company's sample contract form is still required for final visual acceptance and exact styling.

## Flow
1. The final approval transaction commits.
2. The backend loads the saved form, bidder/quotation/cost data, supporting-document metadata, audit records, and approval history.
3. PDFMake renders the 14 required sections inside the Express backend.
4. The PDF is stored in the contract's private Drive folder and its metadata is saved as `GENERATED_PDF`.
5. Authorized users retrieve it through the backend attachment routes.

The `POST /api/forms/:formId/final-pdf` endpoint lets an authorized Admin or assigned Approver download a ZIP containing `Contract_Form.pdf` and the contract's supporting files. It reuses the stored final PDF when present; otherwise, it calls the existing approved-only PDF service and stores one `GENERATED_PDF` attachment before packaging. The final PDF remains available separately in the contract's attachment list. PDF/Drive failure does not roll back approval; the approval response reports the failure and an administrator can retry through this package endpoint.

## Required Sections (14)
| # | Section | Expected data source |
|---|---|---|
| 1 | Contract/Project Identification | `ContractForm`, `User` |
| 2 | Sponsor Department | `Department` |
| 3 | Contract Category and Scope | `ContractCategory`, `ContractForm.scope` |
| 4 | Procurement/Sourcing Rationale | `ContractForm.procurementRationale` |
| 5 | Vendor/Contractor Details | `Vendor`, `VendorType`, `Bidder` |
| 6 | Contract Amount and Currency | `ContractForm`, `Currency` |
| 7 | Budget and Cost Estimate | `CostLine` |
| 8 | Bidders and Quotations | `Bidder`, `Quotation` |
| 9 | Technical Evaluation | `Evaluation` (`TECHNICAL`) |
| 10 | Commercial Evaluation | `Evaluation` (`COMMERCIAL`) |
| 11 | Recommended Vendor and Selection Rationale | `ContractForm`, `Vendor`, `Bidder` |
| 12 | Supporting Documents | `Attachment` metadata |
| 13 | Approval History | `ApprovalStep`, `ApprovalDecision` |
| 14 | Audit/Record Information | `AuditLog`, timestamps, record IDs |

## Implementation
- PDF builder: `backend/src/modules/documents/pdf.service.ts`.
- Approved-only, idempotent storage: `backend/src/modules/documents/final-pdf.service.ts`.
- Final PDF is stored as a `GENERATED_PDF` attachment; its Drive file ID is never exposed to the client.
- Page size, exact labels, branding, and layout matching: **pending the company sample PDF**.
- Contracts retain their `FormSchemaVersion`; the final PDF renders that pinned version's additional
  sections and saved dynamic values without consulting the latest configuration.

## Remaining Acceptance
- Obtain the company sample form (CL-01) and confirm any required field/label details (CL-09).
- Compare generated pages against the sample and adjust only after the target layout is agreed.
- Verify PDF upload and authorized retrieval in the configured non-production Drive folder.
