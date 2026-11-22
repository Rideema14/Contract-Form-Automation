# Contract Forms Automation

Contract Forms Automation is a web application for preparing contract requests, collecting bidder and cost information, routing requests for approval, and storing supporting documents and generated PDFs.

## Project status

The main frontend and backend workflows are implemented in the repository. External setup and end-to-end verification are still required:

- Google Drive integration is implemented, but a real upload and download should be verified with the intended Google account.
- The final PDF generator is implemented. Visual acceptance against the company's contract-form sample is pending.
- Azure deployment is not currently provisioned.

## Main workflows

- Sign in as a Submitter, Approver, or Admin.
- Create and save contract drafts; add bidders, quotations, evaluations, cost lines, and supporting documents.
- Submit completed forms to sequential approvers. Approvers can approve, return, or reject a form.
- Review form status, approval history, and authorized attachments.
- Generate and store the final PDF after approval.
- Use the dashboard and searchable contract register to track forms.
- Admins can manage users and roles and view reference data.

Saving a draft creates a persistent database record. Submitting a form starts its approval workflow. There is no disposable test mode; authorized deletion is audited and does not erase retained audit history.

## Technology and architecture

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, and shadcn/ui
- Backend: Node.js, Express, and TypeScript
- Database: PostgreSQL with Prisma ORM
- Documents: Google Drive API and PDFMake
- Tests: Vitest and Supertest

The browser uses the Next.js frontend, which calls the Express API. Express uses Prisma to access PostgreSQL and calls Google Drive for private file storage. The browser does not access PostgreSQL or receive private Google Drive file IDs.

## Prerequisites

- Node.js 24 (see `.nvmrc`) and npm
- Git
- PostgreSQL
- PowerShell on Windows

Use npm for this project; do not mix npm with pnpm or yarn. See [`docs/local-setup.md`](docs/local-setup.md) for database creation and complete setup instructions.

## Run locally

Create the local environment files from the examples first:

- `backend/.env.example` -> `backend/.env`
- `frontend/.env.example` -> `frontend/.env.local`

Set the backend database and application settings in `backend/.env`. Configure Google Drive credentials only if you intend to test Drive operations. For personal My Drive, the documented setup uses OAuth with the `drive.file` scope and an app-created root folder; see [`docs/google-drive-setup.md`](docs/google-drive-setup.md).

Run the backend in one PowerShell terminal:

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Run the frontend in a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Check backend health at `http://localhost:4000/api/health` and database health at `http://localhost:4000/api/health/db`.

## Useful commands

Run backend commands from `backend/`:

```powershell
npm run typecheck
npm test
npm run build
npm run db:studio
```

Run frontend checks from `frontend/`:

```powershell
npm run lint
npm run build
```

Other backend scripts are listed in `backend/package.json`.

## Git workflow

Branch from `main`, make focused changes, and use pull requests for review. Avoid pushing directly to `main`.

## Documents and Google Drive

Supporting documents are uploaded through the backend, validated against the configured file policy, stored in Google Drive, and linked to their contract in PostgreSQL. The database stores attachment metadata and the private Drive file ID; downloads are permission-checked and streamed through the backend.

With OAuth and no `GOOGLE_DRIVE_FOLDER_ID`, the service finds or creates an app-owned root folder named `Contract Forms Automation`, then creates or reuses a subfolder per contract. A manually created folder may not be visible under `drive.file` unless it was created by or explicitly selected for the OAuth app. Never make files public to work around access problems.

The current upload policy allows PDF, Excel, CSV, Word, PNG/JPEG, and TXT files, up to 10 MiB each and 5 files per request. ZIP files are not currently in the upload allowlist. The uploader checks filename, extension, MIME type, size, and file count; it does not provide malware scanning.

See [`docs/09-google-drive-integration.md`](docs/09-google-drive-integration.md) and [`docs/google-drive-setup.md`](docs/google-drive-setup.md) for routes, authorization, configuration, and verification guidance.

## Repository layout

```text
frontend/  Next.js pages, components, features, API clients, and types
backend/   Express routes, controllers, services, Prisma schema, and tests
docs/      Setup, requirements, architecture, workflow, and deployment guides
```

## Troubleshooting

| Problem | Check |
|---|---|
| Prisma cannot find `DATABASE_URL` | Run Prisma commands from `backend/` and check `backend/.env`. |
| Database connection refused | Start PostgreSQL and verify the local database settings. |
| Browser reports a CORS error | Check that `FRONTEND_ORIGIN` matches the frontend URL. |
| Attachment upload is unavailable | Check that document-upload settings are present and that the form is a draft or returned form owned by the uploader. |
| Google Drive returns 404 for a configured folder | Confirm the authenticated account can access it under `drive.file`; otherwise use the app-owned root-folder setup in the Drive guide. |
| Google OAuth refresh fails | Confirm the refresh token belongs to the configured OAuth client and authorized Google account. Never print or commit OAuth secrets. |

Never commit `.env` files, OAuth credentials, or files under `backend/secrets/`. If a secret is exposed, revoke or rotate it.
