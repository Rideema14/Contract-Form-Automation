# 01. Project Overview

> **Status:** Application implemented and deployed. Core functionality, role-based access control, approval workflow, Google Drive integration, PDF generation, and technical documentation are in place.

## Purpose

The **Contract Forms Automation** application replaces manual, document-based contract forms with a centralized web application.

Staff can create contract forms, save drafts, submit them through a sequential approval process, track their status, and access generated contract PDFs. Supporting documents and generated PDFs are stored securely in Google Drive, while contract records and workflow data are maintained in PostgreSQL.

This application was developed as a company assessment deliverable by a team of three full-stack developers.

## Users

The application supports three roles:

| User Type | Description |
|---|---|
| **SUBMITTER** | Creates and edits their own contract forms, saves drafts, submits forms, tracks contract status, responds to returned forms, and accesses authorized documents. |
| **ADMIN** | Manages users, roles, reference data, contract records, and administrative operations. Has wider access to application data and management features. |
| **APPROVER** | Reviews contracts assigned to them, checks submitted information, adds review comments, and approves or returns contracts as part of the approval workflow. |

Access to application features, contract records, and documents is controlled through backend role-based authorization.

## Scope

The application covers the following functionality:

- Authentication and role-based access control.
- Contract form creation, editing, and draft saving.
- Dynamic form configuration with version management.
- Vendor, bidder, quotation, evaluation, and cost estimate records.
- Sequential approval workflow with comments and approval history.
- Contract status tracking and dashboard statistics.
- Supporting document uploads and private Google Drive storage.
- Final contract PDF generation and storage.
- Authorized document viewing and downloading.
- Searchable and filterable contract register.
- Administrative user and reference data management.
- Azure-based application and database infrastructure.
- Technical documentation, setup instructions, and deployment configuration.

## Expected Outcome

The project delivers:

1. A working web application covering the contract form lifecycle, from creation and draft saving to submission, approval, and document retrieval.
2. A deployed application environment using Azure services.
3. Secure Google Drive storage for supporting documents and generated contract PDFs.
4. Backend-generated contract PDFs containing contract information, bidder details, cost estimates, and approval history.
5. PostgreSQL database persistence with Prisma ORM and version-controlled migrations.
6. Role-based access control for submitters, approvers, and administrators.
7. Technical documentation covering architecture, local setup, database schema, API contracts, Google Drive integration, PDF generation, deployment, and user workflows.

## Delivery Phases

The project follows the four company-defined implementation phases:

| Phase | Description | Delivered Functionality |
|---|---|---|
| **Phase 1** | Main Application and Access Control | Authentication, user roles, contract management, dashboard, and approval workflow. |
| **Phase 2** | Azure Deployment | Azure application and PostgreSQL database infrastructure with deployment configuration. |
| **Phase 3** | Google Drive Storage Integration | Private document storage, attachment management, and authorized file retrieval. |
| **Phase 4** | Completed Contract PDF Generation | Contract PDF generation, storage, and authorized retrieval. |

For the detailed implementation breakdown, refer to [15-four-phase-implementation-plan.md](15-four-phase-implementation-plan.md).