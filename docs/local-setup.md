# Local Setup Guide

This guide explains how developers and reviewers can configure and run the Contract Forms Automation application locally.

The application uses a Next.js frontend, an Express backend, Azure Database for PostgreSQL, and Google Drive for private document storage.

## Prerequisites

Ensure the following tools are installed:

- Windows 10/11
- Node.js (version specified in `.nvmrc`)
- npm
- Git
- Visual Studio Code (recommended)

The application uses a shared Azure PostgreSQL database. Local PostgreSQL installation is not required.

## 1. Clone the Repository

Open PowerShell and run:

```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Contract-Form-Automation
```

Install frontend dependencies:

```powershell
cd frontend
npm install
cd ..
```

Install backend dependencies:

```powershell
cd backend
npm install
cd ..
```

## 2. Configure Environment Variables

Create the following environment files:

- `backend/.env`
- `frontend/.env.local`

Use the respective example files as references:

- `backend/.env.example`
- `frontend/.env.example`

### Backend Configuration

Configure the backend environment variables with the values provided through the project's secure configuration channel.

Important configuration includes:

- `DATABASE_URL` – Azure PostgreSQL connection string.
- `JWT_SECRET` – Secret used for authentication.
- `FRONTEND_ORIGIN` – Frontend application origin.
- Google Drive service account and storage configuration.

The database connection must use the shared Azure PostgreSQL server with SSL enabled.

### Frontend Configuration

Configure the frontend environment:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

This configuration allows the locally running frontend to communicate with the local Express backend.

Never commit environment files, passwords, database credentials, JWT secrets, or Google service account keys to GitHub.

## 3. Generate Prisma Client

Open PowerShell in the project root:

```powershell
cd backend
npx prisma generate
```

This generates the Prisma Client required by the backend.

The application uses the existing shared Azure database. Do not create another database or run database reset, schema push, migrations, or seed commands against the shared database during normal local setup.

## 4. Start the Application

Run the frontend and backend in separate PowerShell terminals.

### Terminal 1: Start Backend

```powershell
cd backend
npm run dev
```

The backend should start on:

```text
http://localhost:4000
```

### Terminal 2: Start Frontend

```powershell
cd frontend
npm run dev
```

The frontend should start on:

```text
http://localhost:3000
```

The locally running backend connects to the shared Azure PostgreSQL database and configured Google Drive storage.

## 5. Verify the Application

Check backend health:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

Check database connectivity:

```powershell
Invoke-RestMethod http://localhost:4000/api/health/db
```

Check frontend availability:

```powershell
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

Open the frontend in your browser:

```text
http://localhost:3000
```

Verify that the application loads successfully and that authentication and database-dependent features work.

## 6. Useful Development Commands

Run these commands from the `backend/` directory:

| Command | Purpose |
|---|---|
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Run the configured migration script |
| `npm run db:studio` | Open Prisma Studio |
| `npm run typecheck` | Check TypeScript types |
| `npm test` | Run backend tests |
| `npm run build` | Build the backend |

Run frontend-specific commands from the `frontend/` directory using the scripts defined in its `package.json`.

**Important:** Never run `prisma migrate reset`, `prisma db push`, or development migrations against the shared Azure database without explicit authorization. Database changes must follow the project's controlled migration process.

## 7. Authentication and Demo Accounts

The application supports role-based access for:

- **ADMIN** – Manages application-wide data, users, roles, and contract administration.
- **APPROVER** – Reviews submitted contracts and performs assigned approval actions.
- **SUBMITTER** – Creates and manages contracts and submits them for approval.

Use the authorized demo accounts and credentials provided separately for application testing.

Public registration is disabled. Access is controlled through the application's authentication and authorization mechanisms.

## 8. Showcase PDF Attachment Verification

The project includes a showcase contract:

**Procurement Attachment Demonstration**

- Contract Reference: `CF-SHOW-0009`
- Purpose: Demonstrates supporting document upload and PDF attachment handling.

To verify the attachment workflow:

1. Sign in using an authorized Submitter account.
2. Open the showcase contract `CF-SHOW-0009`.
3. Upload a valid PDF as a Supporting document.
4. Confirm that the attachment appears in the contract's attachment list.
5. Verify that the document can be opened or downloaded through the application.

Supporting files are stored in private Google Drive storage and accessed through the backend.

## 9. Optional Demo Login Cards

The login page supports optional demo login cards for Admin, Approver, and Submitter accounts.

These can be enabled through the following frontend environment variable:

```env
NEXT_PUBLIC_DEMO_LOGIN_ENABLED=true
```

Configure the corresponding demo account email and password variables only when required.

**Security note:** Variables prefixed with `NEXT_PUBLIC_` are exposed to browser-side code. Use only disposable demo credentials in non-production environments. Never expose production account credentials through frontend environment variables.

Restart the frontend after changing environment variables.

## 10. Troubleshooting

| Issue | Possible Solution |
|---|---|
| Backend does not start | Check backend dependencies, environment variables, and port 4000. |
| Frontend does not start | Check frontend dependencies and port 3000. |
| Database connection fails | Verify the Azure PostgreSQL connection string, SSL configuration, and network access permissions. |
| Authentication fails | Verify the configured backend environment and use an authorized account. |
| Google Drive operations fail | Verify service account configuration and Drive folder permissions. |
| Frontend cannot communicate with backend | Verify `NEXT_PUBLIC_API_BASE_URL` and `FRONTEND_ORIGIN`. |
| PDF generation fails | Check backend logs and document-generation configuration. |

For application usage and workflow instructions, refer to `user-guide.md`.