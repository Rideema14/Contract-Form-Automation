# Architecture

## System Architecture

```text
USER BROWSER (localhost:3000)
        |
        v
NEXT.JS FRONTEND (React + TypeScript)
        |
        | HTTP REST API
        v
EXPRESS BACKEND (localhost:4000, /api)
        |
        |---- PRISMA ORM
        |        |
        |        v
        |    AZURE DATABASE FOR POSTGRESQL
        |    (Shared Azure PostgreSQL Server)
        |
        |---- GOOGLE DRIVE API
        |        |
        |        v
        |    PRIVATE FILE STORAGE
        |
        |---- PDFMAKE
                 |
                 v
             GENERATED PDF
```

### Request Flow

The browser communicates with the Next.js frontend. The frontend sends API requests to the Express backend. The backend handles business logic, authentication, authorization and data validation.

Prisma ORM is used to communicate with the shared Azure PostgreSQL database. The backend also communicates with Google Drive over HTTPS for private document storage and retrieval.

PDFMake runs inside the Express backend to generate contract documents.

### Architecture Rules

- The browser never connects directly to PostgreSQL.
- The browser never accesses Google Drive using private service account credentials.
- All database operations are performed by the backend through Prisma ORM.
- Google Drive file operations are handled by the backend.
- PDFMake runs inside the Express backend (`backend/src/modules/documents/pdf.service.ts`); it is not a separate service.
- The project uses one Git repository with separate `frontend/` and `backend/` applications.
- Prisma schema and migrations are maintained inside `backend/prisma/`.
- The application currently runs locally while connecting to the shared Azure PostgreSQL database.
- Application deployment to Azure is a separate step. Refer to `deployment-azure.md` for deployment details.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui |
| Forms / Validation | React Hook Form + Zod |
| Backend | Node.js, Express, TypeScript, REST API |
| Database | Azure Database for PostgreSQL |
| ORM / Migrations | Prisma |
| Authentication | JWT with secure HttpOnly cookies |
| Password Security | bcrypt password hashing |
| Authorization | Role-Based Access Control (RBAC) |
| File Storage | Google Drive API v3 (`googleapis`), private file storage, backend only |
| PDF Generation | PDFMake inside Express backend |
| Security | Helmet, CORS, cookie-parser, express-rate-limit, server-side authorization |
| Testing | Vitest + Supertest |
| Source Control | Git + GitHub |

## Application Components

### 1. Frontend
The Next.js frontend provides the user interface for authentication, contract creation, contract management, approvals, document access and dashboard operations.

### 2. Backend
The Express backend provides REST APIs and handles business logic, request validation, authentication, role-based permissions, database operations, Google Drive integration and PDF generation.

### 3. Database
Azure Database for PostgreSQL stores application data, including users, contracts, vendors, bidders, approval information and document metadata.

Prisma ORM manages database access and migrations.

### 4. Google Drive Integration
Google Drive is used to store supporting documents and generated PDFs. Files are handled through the backend, and private credentials are not exposed to the frontend.

### 5. PDF Generation
PDFMake generates contract documents on the backend using contract information, bidder details, cost information, supporting document details and approval history.