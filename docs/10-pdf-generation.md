# PDF Generation

## Implementation

The backend uses PDFMake for PDF generation. PDF routes are mounted under `/api/forms/:formId`.

Verified routes:

- `GET /api/forms/:formId/pdf` - generate/download a current contract snapshot
- `POST /api/forms/:formId/final-pdf/generate` - generate or retrieve the approved final PDF attachment
- `POST /api/forms/:formId/final-pdf` - download a package of PDF/package files for ADMIN or APPROVER

The attachment router does not expose Google Drive IDs in public PDF metadata.

## Current PDF

The current PDF is generated from live contract data and may be downloaded while the contract is accessible to the authenticated user.

## Final PDF

Final PDF generation is available only after the caller passes form view authorization and the role is one of ADMIN, APPROVER, or SUBMITTER. The implementation can store the final PDF as a `GENERATED_PDF` attachment when document storage is configured.

## Download security

PDF responses use:

- `Content-Type: application/pdf`
- authenticated attachment disposition
- `X-Content-Type-Options: nosniff`
- `Cache-Control: private, no-store`

## Package behavior

The contract-package endpoint is restricted to ADMIN and APPROVER roles. Live package contents and filename conventions are implemented in the document/final-PDF services; they should be verified through an approved disposable contract.

## Google Drive dependency

Final PDF storage and attachment retrieval require Google Drive configuration and a successful provider upload. Current snapshots can be generated without persistent storage, subject to the implementation's data access checks.

## Verification status

- PDFMake implementation: verified
- Route names: verified
- Live PDF layout and visual quality: **Needs verification**
- Live Google Drive attachment persistence: **Needs verification**
