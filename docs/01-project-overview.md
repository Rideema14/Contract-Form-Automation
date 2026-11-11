# 01. Project Overview

> **Status:** Setup and documentation stage. No application features are implemented yet.

## Purpose
The **Contract Forms Automation** application replaces manual, document-based contract forms with a single web application. Staff create a contract form, route it through a sequential approval process, and receive a final PDF that follows the company's contract form format. Supporting documents and generated PDFs are stored in Google Drive.

This is a company assessment deliverable built by three full-stack developers.

## Users
| User type | Description |
|---|---|
| **User** | Creates and edits contract forms, saves drafts, submits forms, tracks status, and views documents they are authorized to see. |
| **Admin** | Has User capabilities plus administrative management (users, roles, reference data) and wider visibility. Exact Admin powers over forms are listed in [02-requirements.md](02-requirements.md) as items to confirm. |
| **Approver** | A participant in the approval chain. Whether this is a separate role or a User/Admin assigned to a step is **to be confirmed** by the company. |

## Scope
In scope (see [02-requirements.md](02-requirements.md) for the full list):
- Authentication and role-based access control
- Contract form creation, editing and draft saving
- Vendor, bidder, quotation, evaluation and cost estimate records
- Sequential approval workflow with comments, history and audit trail
- Notifications to the next approval participant
- Document uploads, Google Drive storage and PDF generation
- Dashboard and searchable contract register
- Azure deployment and deployment documentation

Out of scope: any feature not listed above. Do not add unrelated product features.

## Expected Outcome
1. A working web application covering the full contract form lifecycle.
2. A deployed Azure environment with deployment documentation.
3. Google Drive storage for supporting documents and generated PDFs.
4. A generated contract PDF following the company's sample form.
5. Complete technical documentation so any developer can set up, run and extend the project.

## Delivery Phases
The company-defined phases are: (1) Main application and access control, (2) Azure deployment, (3) Google Drive storage integration, (4) Completed contract PDF generation. Details: [15-four-phase-implementation-plan.md](15-four-phase-implementation-plan.md).
