# 04. Folder Structure

## Project Structure

The project is organized into two main applications: `frontend` and `backend`, along with a documentation directory.

```text
Contract-Form-Automation/
│
├── frontend/
│   ├── public/                   Static assets
│   └── src/
│       ├── app/                  Next.js App Router pages and layouts
│       ├── components/           Reusable React components
│       ├── services/             Backend API communication
│       ├── hooks/                Custom React hooks
│       ├── lib/                  Shared frontend utilities
│       ├── schemas/              Zod validation schemas
│       └── styles/               Global styles and Tailwind CSS
│
├── backend/
│   ├── src/
│   │   ├── config/               Environment and service configuration
│   │   ├── middleware/           Authentication, authorization and validation
│   │   ├── routes/               REST API route definitions
│   │   ├── controllers/          Request and response handling
│   │   ├── services/             Business logic and integrations
│   │   ├── validators/           Request validation schemas
│   │   ├── utils/                Shared backend utilities
│   │   └── app.ts                Express application setup
│   │
│   ├── prisma/
│   │   ├── schema.prisma         Database schema
│   │   ├── migrations/           Version-controlled database migrations
│   │   └── seed files            Initial and demonstration data
│   │
│   └── tests/                    Backend tests
│
├── docs/                         Technical documentation
│
├── .gitignore                    Git ignored files
├── README.md                     Project overview and setup guide
└── .env.example                  Environment variable reference
```

*Note: This diagram represents the logical organization of the application. Refer to the actual repository for the exact filenames and nested folders.*

## Frontend Organization

The frontend uses Next.js App Router with React and TypeScript.

| Directory | Responsibility |
|---|---|
| `app/` | Application pages, layouts, and routing. |
| `components/` | Reusable UI components and feature-specific components. |
| `services/` | API client functions for communicating with backend modules. |
| `hooks/` | Reusable custom React hooks. |
| `lib/` | Shared utilities, API helpers, authentication helpers, and formatters. |
| `schemas/` | Zod schemas used for frontend form validation. |
| `styles/` | Global CSS and Tailwind CSS styles. |
| `public/` | Static images, icons, and other public assets. |

### Main Application Areas

The frontend provides interfaces for:

- Login and authentication.
- Dashboard and contract register.
- Contract creation, viewing, and editing.
- Draft management.
- Approval inbox and decision screens.
- Supporting documents and generated PDFs.
- Administrative user and reference data management.

## Backend Organization

The backend uses Node.js, Express.js, and TypeScript.

| Directory | Responsibility |
|---|---|
| `config/` | Environment configuration, Prisma client, Google Drive configuration, and application constants. |
| `middleware/` | Authentication, RBAC, ownership checks, request validation, upload handling, and error handling. |
| `routes/` | REST API endpoint definitions and route registration. |
| `controllers/` | Handles incoming requests and prepares API responses. |
| `services/` | Contains business logic, database operations, and external service integrations. |
| `validators/` | Shared Zod validation schemas. |
| `utils/` | Common helpers, logging, error handling, and reusable utilities. |
| `prisma/` | Database schema, migrations, and seed scripts. |
| `tests/` | Backend unit and integration tests. |

## Main Backend Feature Areas

The backend functionality is organized around the following feature areas:

| Module | Responsibility |
|---|---|
| `auth` | Login, authentication, session handling, and current-user information. |
| `users` | User profiles, account management, and role administration. |
| `dashboard` | Contract statistics and register queries. |
| `admin` | Administrative operations and reference data management. |
| `forms` | Contract form creation, updates, drafts, and submission. |
| `vendors` | Vendor records and vendor type management. |
| `bidders` | Bidder details and quotation records. |
| `evaluations` | Technical and commercial evaluation information. |
| `cost-estimates` | Cost breakdowns and Excel estimate imports. |
| `approvals` | Sequential approval workflow, decisions, and approval history. |
| `audit` | Audit event recording and retrieval. |
| `notifications` | Notifications associated with approval workflow actions. |
| `documents` | Supporting document uploads, metadata, private Google Drive operations, and authorized downloads. |
| `form-builder` | Dynamic form configuration, drafts, publishing, and schema versioning. |
| `PDF generation` | Contract PDF rendering and final document generation. |

These are logical feature areas. Their actual implementation may be distributed across route, controller, and service files rather than existing as separate folders for every module.

## Database Organization

Database-related files are maintained under `backend/prisma/`.

| File / Directory | Responsibility |
|---|---|
| `schema.prisma` | Defines database models, fields, relationships, and constraints. |
| `migrations/` | Stores version-controlled database schema changes. |
| Seed scripts | Insert initial or demonstration records where required. |

Prisma ORM is used for database access and migration management.

## Development Conventions

1. **Naming:** Use consistent naming conventions. TypeScript files generally use `.ts`, React components use `.tsx`, and React components use PascalCase names.

2. **Separation of responsibilities:** Routes handle endpoint definitions, controllers handle HTTP requests and responses, and services contain business logic.

3. **Reusable components:** Shared frontend UI elements and backend utilities should be reused instead of duplicated.

4. **Validation:** Validate incoming data on the backend even when equivalent frontend validation exists.

5. **Database access:** Database operations should be handled through Prisma and organized within the appropriate service layer.

6. **Security:** Authentication, role permissions, ownership checks, and sensitive integrations must remain under backend control.

7. **Environment configuration:** Credentials, database connection strings, and API secrets must be stored in environment variables and must never be committed to Git.