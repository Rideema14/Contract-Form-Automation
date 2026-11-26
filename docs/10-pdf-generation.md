# PDF Generation and Template Specification

## 1. Overview

The Contract Forms Automation application uses **PDFMake** to generate contract PDF documents within the Express backend.

Generated PDFs contain contract information, procurement details, vendor and bidder information, financial details, supporting document references, evaluation information, approval history, and audit-related records.

The generated PDF is stored in the contract's private Google Drive folder, while its metadata is maintained in PostgreSQL.

PDF generation and private Drive storage are integrated into the application's contract approval workflow.

## 2. PDF Generation Flow

The official final PDF is generated after the final approval transaction is successfully committed.

```text
FINAL APPROVAL
      |
      v
APPROVAL TRANSACTION COMMITTED
      |
      v
BACKEND LOADS CONTRACT DATA
      |
      |---- Contract Details
      |---- Bidder / Quotation Data
      |---- Cost Information
      |---- Supporting Documents
      |---- Evaluation Records
      |---- Approval History
      |---- Audit Records
      |
      v
PDFMAKE GENERATES PDF
      |
      v
PRIVATE GOOGLE DRIVE STORAGE
      |
      v
POSTGRESQL METADATA SAVED
(GENERATED_PDF)
      |
      v
AUTHORIZED DOCUMENT ACCESS
```

### Generation Steps

1. The final approval transaction is committed successfully.
2. The backend loads the saved contract form and its associated information.
3. PDFMake renders the required 14 sections inside the Express backend.
4. The generated PDF is stored in the contract's private Google Drive folder.
5. The backend saves the document metadata in PostgreSQL with the category `GENERATED_PDF`.
6. Authorized users can retrieve the generated PDF through the application's attachment routes.

## 3. Required PDF Sections

The generated contract PDF contains the following 14 sections:

| # | Section | Data Source |
|---|---|---|
| 1 | Contract/Project Identification | `ContractForm`, `User` |
| 2 | Sponsor Department | `Department` |
| 3 | Contract Category and Scope | `ContractCategory`, `ContractForm.scope` |
| 4 | Procurement/Sourcing Rationale | `ContractForm.procurementRationale` |
| 5 | Vendor/Contractor Details | `Vendor`, `VendorType`, `Bidder` |
| 6 | Contract Amount and Currency | `ContractForm`, `Currency` |
| 7 | Budget and Cost Estimate | `ContractForm.budgetProvision`, `CostLine`, `ContractForm.taxAmount` |
| 8 | Bidders and Quotations | `Bidder`, `Quotation` |
| 9 | Technical Evaluation | `Evaluation` (`TECHNICAL`) |
| 10 | Commercial Evaluation | `Evaluation` (`COMMERCIAL`) |
| 11 | Recommended Vendor and Selection Rationale | `ContractForm`, `Vendor`, `Bidder` |
| 12 | Supporting Documents | `Attachment` metadata |
| 13 | Approval History | `ApprovalStep`, `ApprovalDecision` |
| 14 | Audit/Record Information | `AuditLog`, timestamps, record IDs |

### Section Details

**1. Contract/Project Identification**

Contains the contract reference number, project information, identification details, and relevant creator information.

**2. Sponsor Department**

Displays the department responsible for sponsoring the contract.

**3. Contract Category and Scope**

Includes the selected contract category and description of the contract scope.

**4. Procurement/Sourcing Rationale**

Explains the procurement approach and the rationale behind the sourcing decision.

**5. Vendor/Contractor Details**

Displays vendor and contractor information, including relevant vendor classification and bidder details.

**6. Contract Amount and Currency**

Displays the contract amount and its associated currency.

**7. Budget and Cost Estimate**

Includes the planned budget, cost breakdown, and applicable tax amount.

**8. Bidders and Quotations**

Displays bidder information and associated quotation details.

**9. Technical Evaluation**

Contains technical evaluation information for the participating bidders.

**10. Commercial Evaluation**

Contains commercial evaluation information and related assessment details.

**11. Recommended Vendor and Selection Rationale**

Displays the recommended vendor and the documented reason for selection.

**12. Supporting Documents**

Lists supporting document information associated with the contract.

**13. Approval History**

Displays the approval workflow, approver information, decisions, comments, and relevant timestamps.

**14. Audit/Record Information**

Contains relevant record identifiers, timestamps, and audit information associated with the contract.

## 4. PDF Download and Generation APIs

The application supports different PDF operations depending on the user's requirements and contract status.

### A. Current Contract PDF Snapshot

| Property | Details |
|---|---|
| Method | GET |
| Endpoint | `/api/forms/:formId/pdf` |
| Access | Contract creator |
| Purpose | Generates a PDF snapshot of the current saved contract form. |

This endpoint allows the contract creator to download a snapshot of the current saved form at any contract status.

The snapshot is generated on demand and is not stored as an official final PDF attachment.

### B. Generate or Retrieve Official Final PDF

| Property | Details |
|---|---|
| Method | POST |
| Endpoint | `/api/forms/:formId/final-pdf/generate` |
| Access | Contract creator, assigned Approver, or Admin for approved forms |
| Purpose | Creates or retrieves the official final PDF. |

For approved contracts, this endpoint generates the official stored final PDF or retrieves the existing one.

The generated PDF is stored as a `GENERATED_PDF` attachment.

The client then downloads the PDF through the normal authorized attachment route.

This operation does not repeat the approval workflow.

### C. Download Final PDF Package

| Property | Details |
|---|---|
| Method | POST |
| Endpoint | `/api/forms/:formId/final-pdf` |
| Access | Authorized Admin or assigned Approver |
| Purpose | Downloads a ZIP package containing the final PDF and supporting files. |

The ZIP package contains:

- `Contract_Form.pdf`
- The contract's associated supporting files.

The endpoint reuses the stored final PDF when available. Otherwise, it invokes the existing approved-only PDF service and stores one `GENERATED_PDF` attachment before creating the package.

The official final PDF also remains available separately in the contract's attachment list.

## 5. PDF Storage and Metadata

Generated PDFs are stored in the corresponding private Google Drive contract folder.

The backend maintains the associated metadata in PostgreSQL.

| Property | Description |
|---|---|
| Document Category | `GENERATED_PDF` |
| Storage | Private Google Drive |
| Metadata Storage | PostgreSQL |
| Association | Related contract record |
| Access | Authorized backend attachment routes |

The Google Drive File ID is never exposed directly to the frontend.

## 6. Approval and PDF Consistency

The official final PDF is generated using saved contract information after the final approval transaction has committed.

The backend loads the relevant contract information, including:

- Contract details.
- Vendor and bidder information.
- Quotation details.
- Cost estimates.
- Supporting document metadata.
- Technical and commercial evaluations.
- Approval history.
- Audit information.

PDF generation and Drive storage are separate operations from the approval transaction.

A PDF or Google Drive failure does not roll back an already committed approval.

In such cases:

- The approval remains committed.
- The approval response reports the PDF or storage failure.
- An authorized administrator can retry through the final PDF package endpoint.

This keeps approval processing independent from document storage availability.

## 7. Versioned Form Schema Support

Each contract retains its original `FormSchemaVersion`.

The PDF generation service uses the contract's pinned form schema version rather than the latest published configuration.

This ensures that:

- Previously created contracts retain their original form structure.
- New form publications do not change existing contract definitions.
- Saved `dynamicValues` are rendered using the applicable version.
- Additional configured sections and fields are included according to the contract's associated schema version.

## 8. PDF Security

The PDF generation and retrieval process follows the application's security model.

- PDF generation runs inside the Express backend.
- Google Drive files remain private.
- Document access requires authentication and authorization.
- Only authorized users can retrieve contract PDFs.
- Drive File IDs are not exposed to the frontend.
- The final PDF is stored as a document attachment.
- Approval and PDF generation operations follow their respective permission rules.

## 9. Implementation References

The PDF generation and storage implementation is maintained in the following backend files:

| File | Responsibility |
|---|---|
| `backend/src/modules/documents/pdf.service.ts` | Builds and renders contract PDFs using PDFMake. |
| `backend/src/modules/documents/final-pdf.service.ts` | Handles approved-only final PDF generation and idempotent storage. |
| `backend/src/modules/documents/drive.service.ts` | Handles Google Drive file operations. |
| `backend/src/modules/documents/attachments.router.ts` | Handles authorized attachment access and document operations. |

## 10. Visual Template and Formatting

The generated PDF follows the contract form structure and includes the required sections and associated contract information.

The company's sample contract form (CL-01) serves as the visual reference for reviewing presentation details such as:

- Page size and orientation.
- Company branding and logo.
- Section headings and labels.
- Tables and column layouts.
- Spacing and typography.
- Headers and footers.
- Page numbering and document formatting.

The generated document maintains the required contract information, bidder and cost tables, supporting document references, approval history, and audit information.