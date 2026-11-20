# PDF template specification

PDFMake generates the final approved contract PDF inside `backend/src/modules/documents/pdf.service.ts`.

Flow: read saved contract, bidder/cost rows and approval history -> build PDF -> upload to the private Drive
folder -> store Drive File ID and metadata -> authorized users retrieve it. Generation runs after the final
approval transaction commits; a storage or PDF error does not reverse approval, and the approval response
reports the PDF failure so an administrator can retry.

## Required sections (all 14)
1. Contract / Project Identification
2. Sponsor Department
3. Contract Category and Scope
4. Procurement / Sourcing Rationale
5. Vendor / Contractor Details
6. Contract Amount and Currency
7. Budget and Cost Estimate
8. Bidders and Quotations
9. Technical Evaluation
10. Commercial Evaluation
11. Recommended Vendor and Selection Rationale
12. Supporting Documents
13. Approval History
14. Audit / Record Information

## Required tables
Bidders / quotations, cost estimates, approval history.

## Layout
Clear headings and tables; show form identifier, current status and relevant dates; readable, consistent,
no cut-off long text or tables. Every value comes from the saved form data (no hard-coded values).
Test page breaks, long tables, fonts and large documents.

The current PDF styling is provisional technical output only. Exact page design, branding, and any additional labels remain pending the approved company sample; no legal wording or fields should be invented.
