# Contract Forms Automation

**End-to-End Contract Management, Approval Workflow & Document Automation Platform**

Contract Forms Automation is a full-stack web application designed to digitize and streamline the contract approval lifecycle. It enables users to create and manage contract forms, maintain bidder and cost information, upload supporting documents, process approval workflows, and generate structured PDF documents.

The platform provides role-based access control, centralized contract management, document storage through Google Drive, and an auditable approval process.

---

## 1. Project Overview

Traditional contract approval processes often involve manually prepared documents, disconnected spreadsheets, email-based approvals, and scattered file storage.

Contract Forms Automation addresses these challenges through a centralized application that manages the complete contract lifecycle:

- Contract form creation and draft management.
- Vendor, bidder, and quotation management.
- Budget and cost estimation.
- Supporting document uploads.
- Multi-stage approval workflows.
- Role-based access control.
- Automated PDF generation.
- Approval history and audit tracking.
- Centralized contract register and dashboard.

The application is designed to provide a structured, secure, and traceable workflow for contract submissions and approvals.

## 2. Key Features

### Dashboard & Contract Register
- Centralized dashboard with contract summary cards.
- Overview of total forms, drafts, pending approvals, approved, rejected, and returned forms.
- Searchable and filterable contract register.
- Contract details including form identifier, project title, department, vendor, amount, submission date, and status.
- Role-based access to contract records.

### Contract Form Management
- Create, save, edit, and manage contract forms.
- Save incomplete forms as drafts.
- Reopen and continue editing saved drafts.
- Submit completed forms for approval.
- Capture contract identification, department, category, scope, and sourcing rationale.
- Maintain vendor and contractor information.
- Support contract amounts, currencies, and budget details.

### Bidders & Evaluation
- Add and manage multiple bidders.
- Capture bidder details, qualifications, and quoted amounts.
- Maintain technical and commercial evaluation information.
- Record recommended vendor selection and justification.

### Cost Estimation
- Support multiple cost breakdown entries.
- Capture subtotal, tax, total amount, and budget provisions.
- Associate cost estimates with the relevant contract form.

### Approval Workflow
- Assign authorized approvers.
- Process submitted forms through the approval workflow.
- Approve, reject, or return forms with comments.
- Maintain approval decisions, responsible users, and timestamps.
- Track current approval status and approval history.

### Google Drive Document Management
- Store supporting documents and generated PDFs in Google Drive.
- Maintain document metadata in PostgreSQL.
- Associate uploaded documents with their respective contract forms.
- Support authorized document viewing and downloading.
- Maintain document information such as file name, file type, category, uploader, upload date, and version or approval status where applicable.

### Automated PDF Generation
- Generate structured contract approval PDFs from application data.
- Present contract information in organized, table-based sections.
- Include bidder information, quotations, cost estimates, and approval history.
- Provide downloadable PDF documents.
- Make final approved documentation accessible through the relevant contract record.

### Role-Based Access Control (RBAC)
The application supports role-based permissions enforced through backend authorization and frontend access controls.

| Capability | User / Submitter | Admin |
|---|---|---|
| Create contract forms | Yes | Yes |
| Manage own drafts | Yes | Yes |
| Submit forms | Yes | Yes |
| View own forms | Yes | Yes |
| Access authorized attachments | Yes | Yes |
| Manage all forms | No | Yes |
| Manage reference data | No | Yes |
| Manage user roles | No | Yes |
| Manage approvers | No | Yes |
| Access audit history | Restricted | Yes |

Approver permissions are enforced according to the assigned approval responsibilities.

The backend validates access to protected resources to prevent unauthorized access to other users' records.

### Audit & Traceability
- Track significant application actions.
- Maintain approval decisions and status transitions.
- Record relevant actors and timestamps.
- Preserve contract ownership and workflow history.

---

## 3. Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Document Storage | Google Drive API |
| PDF Generation | PDFMake |
| Authentication | JWT, password hashing |
| Testing | Vitest, Supertest |
| Version Control | Git, GitHub |
| Deployment | Azure |

---

## 4. Application Architecture

The application follows a client-server architecture with a separate frontend, backend API, relational database, and external document storage.

```text
                 USERS
                   |
                   v
          Next.js Frontend
           React / TypeScript
                   |
                   v
             Express API
           Node.js / TypeScript
                   |
          +--------+---------+
          |                  |
          v                  v
     Prisma ORM          Google Drive API
          |                  |
          v                  v
    PostgreSQL         Supporting Documents
    Database           & Generated PDFs
          |
          v
    Forms, Users,
    Approvals, Bidders,
    Costs & Audit Data
```

### Architecture Responsibilities

**Frontend**
- Provides the application interface.
- Handles form interactions and validation.
- Displays dashboards, contract registers, and approval screens.
- Communicates with backend APIs.

**Backend**
- Implements business logic and API endpoints.
- Handles authentication and authorization.
- Validates incoming requests.
- Manages contract forms and approval workflows.
- Integrates with Google Drive and PDF generation.

**PostgreSQL**
- Stores structured application data.
- Maintains relationships between users, forms, vendors, bidders, approvals, and document metadata.

**Google Drive**
- Stores uploaded supporting documents and generated PDFs.
- Provides document access through authorized application workflows.

---

## 5. Repository Structure

```text
Contract-Form-Automation/
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   │
│   ├── src/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   ├── schemas/
│   │   ├── utils/
│   │   ├── types/
│   │   └── lib/
│   │
│   └── package.json
│
├── docs/
│   ├── local-setup.md
│   ├── architecture.md
│   ├── api-contract.md
│   ├── database-schema.md
│   ├── google-drive-setup.md
│   ├── pdf-template-spec.md
│   └── deployment-azure.md
│
├── .github/
│   └── workflows/
│
├── .gitignore
├── .nvmrc
└── README.md
```

---

## 6. Prerequisites

Before setting up the project, ensure the following are installed:

- Node.js version specified in `.nvmrc`.
- npm.
- Git.
- PostgreSQL.
- PowerShell (for Windows users).

---

## 7. Local Development Setup

### Step 1: Clone the Repository

```bash
git clone <https://github.com/Rideema14/Contract-Form-Automation>
cd Contract-Form-Automation
```

Checkout the completed development branch:

```bash
git checkout develop
```

### Step 2: Backend Setup

```powershell
cd backend
npm install
```

Configure the backend environment variables using the provided example:

```powershell
Copy-Item .env.example .env
```

Configure the required database connection and application secrets in `backend/.env`.

Generate the Prisma client:

```bash
npx prisma generate
```

Apply existing migrations to a fresh local development database:

```bash
npx prisma migrate deploy
```

If sample data is required, configure the seed environment and use the documented seed procedure.

Start the backend:

```bash
npm run dev
```

The backend API runs on:

```text
http://localhost:4000
```

### Step 3: Frontend Setup

Open another terminal:

```powershell
cd frontend
npm install
```

Configure the frontend environment:

```powershell
Copy-Item .env.example .env.local
```

Set the API base URL:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Start the frontend:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:3000
```

### Step 4: Verify the Application

Check backend health:

```text
http://localhost:4000/api/health
```

Check database connectivity:

```text
http://localhost:4000/api/health/db
```

Open the frontend:

```text
http://localhost:3000
```

**Important:** Use a separate local development database when following local database setup instructions. Do not run development migration or seed commands against a shared production Azure database.

---

## 8. Environment Configuration

Environment variables are used to configure database connectivity, authentication, external integrations, and application URLs.

### Backend

Configure the variables required by the backend in:

```text
backend/.env
```

Typical configuration:

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_secure_jwt_secret
FRONTEND_ORIGIN=http://localhost:3000
```

Google Drive credentials and other integration settings must be configured according to:

`docs/google-drive-setup.md`

### Frontend

Configure:

```text
frontend/.env.local
```

Example:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

Only values intended to be publicly accessible should use the `NEXT_PUBLIC_` prefix.

**Security Guidelines**
- Never commit `.env` or `.env.local` files.
- Never expose database credentials or JWT secrets.
- Never commit Google Drive service account credentials or OAuth secrets.
- Use secure environment variables in the deployment environment.
- Keep sensitive configuration outside the source code.

---

## 9. Database & Migrations

The application uses PostgreSQL for structured data persistence and Prisma as its ORM.

The Prisma schema defines the application's data models, relationships, constraints, and enumerations.

### Important Files

| File / Directory | Purpose |
|---|---|
| `backend/prisma/schema.prisma` | Database schema |
| `backend/prisma/migrations/` | Version-controlled migration history |
| `backend/prisma/seed.ts` | Sample/reference data seeding |
| `backend/prisma.config.ts` | Prisma configuration |

### Database Setup

Generate Prisma Client:

```bash
npx prisma generate
```

Apply committed migrations to a fresh database:

```bash
npx prisma migrate deploy
```

Run the seed script only when sample data is required and the target database has been verified.

The repository includes the database schema and migration history required to reproduce the database structure.

For additional details, see:

`docs/database-schema.md`

---

## 10. API Documentation

The Express backend exposes REST APIs for the application's core modules.

The API covers:

- Authentication and user management.
- Contract form management.
- Vendor and bidder management.
- Cost estimates.
- Approval workflow.
- Supporting document management.
- PDF generation and retrieval.
- Audit and approval history.

Refer to:

`docs/api-contract.md`

for endpoint details, request formats, response structures, and authorization requirements.

---

## 11. Google Drive Integration

Google Drive is used as the document storage layer for supporting attachments and generated contract PDFs.

The application maintains document metadata in PostgreSQL and associates stored files with their respective contract forms.

The integration supports:
- Uploading supporting documents.
- Storing generated PDF files.
- Maintaining file identifiers and metadata.
- Associating documents with contract records.
- Authorized file viewing and downloading.

Google Drive configuration and setup instructions:

`docs/google-drive-setup.md`

---

## 12. PDF Generation

The backend uses PDFMake to generate structured contract approval documents from application data.

Generated PDFs organize contract information into readable sections, including:

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

The PDF includes relevant form identifiers, statuses, dates, and structured tables for bidders, cost estimates, and approval history.

Refer to:

`docs/pdf-template-spec.md`

for PDF structure and implementation details.

---

## 13. Testing

The project uses Vitest and Supertest for automated testing.

Run backend tests:

```bash
cd backend
npm test
```

Run backend type checking:

```bash
npm run typecheck
```

Run backend build:

```bash
npm run build
```

Testing covers application functionality, API behavior, validation, and access-control-related scenarios.

Refer to the individual test files and the test report for detailed coverage and execution results.

---

## 14. Azure Deployment

The application uses Azure Database for PostgreSQL Flexible Server for its shared database environment.

The frontend and backend application hosting deployment is a separate step from database hosting.

The deployment process includes:

- Frontend and backend hosting configuration.
- Production environment variables.
- Azure PostgreSQL connection configuration.
- Secure database connectivity.
- CORS and API URL configuration.
- Google Drive integration configuration.
- Deployment verification.
- Budget monitoring and cost alerts.

**Deployment status:** Application hosting deployment and production URL will be documented after deployment is completed.

For deployment instructions and configuration, refer to:

`docs/deployment-azure.md`

---

## 15. Security Considerations

Security is implemented across the frontend, backend, database, and document-access layers.

Key considerations include:

- JWT-based authentication.
- Password hashing.
- Backend-enforced role-based authorization.
- Ownership-based access to contract records.
- Validation of API requests.
- Controlled approval actions.
- Restricted access to supporting documents.
- Protection of database and third-party credentials.
- Audit tracking of significant actions.

---

## 16. Additional Documentation

Detailed technical documentation is maintained separately:

| Document | Description |
|---|---|
| `docs/local-setup.md` | Local development setup |
| `docs/architecture.md` | System architecture |
| `docs/api-contract.md` | Backend API documentation |
| `docs/database-schema.md` | Database models and relationships |
| `docs/google-drive-setup.md` | Google Drive integration setup |
| `docs/pdf-template-spec.md` | Generated PDF structure |
| `docs/deployment-azure.md` | Azure deployment instructions |

---

## 17. Demo & Application Links

| Resource | Link |
|---|---|
| GitHub Repository | `https://github.com/Rideema14/Contract-Form-Automation` |
| Application URL | To be added after Azure deployment |
| Demo Video | To be added |
| API Documentation | `docs/api-contract.md` |

---

## 18. Team Contributions

This assessment is developed collaboratively by a team of three members.

Each member contributes to the development, integration, testing, documentation, and delivery of the application.

Individual responsibilities and contributions can be documented here.

| Team Member | Contribution |
|---|---|
| Team Member 1 | Apoorva Asati |
| Team Member 2 | Shourya Jain |
| Team Member 3 | Rideema Singh |

---

## 19. Project Status

The core application implementation, database integration, and functional development have been completed.

| Component | Status |
|---|---|
| Frontend application | Completed |
| Backend APIs | Completed |
| PostgreSQL database | Configured |
| Prisma schema and migrations | Available |
| Authentication | Implemented |
| Role-based access control | Implemented |
| Contract management | Implemented |
| Approval workflow | Implemented |
| Google Drive integration | Implemented |
| PDF generation | Implemented |
| Dashboard and contract register | Implemented |
| Automated testing | Implemented |
| Technical documentation | Finalization |
| Azure application deployment | Implemented |

---

## 20. Assessment Objective

The objective of Contract Forms Automation is to provide a complete, reproducible, and secure contract approval management solution.

The platform brings contract creation, structured data management, document storage, approval processing, and PDF generation into one centralized workflow.

It is designed to reduce manual effort, improve process visibility, maintain accountability, and provide reliable access to contract records and their associated documentation.
