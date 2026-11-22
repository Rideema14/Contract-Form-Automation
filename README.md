
# Contract Forms Automation

Web application that digitizes contract approval forms: create a request, add bidders and cost rows,
attach supporting documents (private Google Drive), route it through approval, and generate the final PDF.

**Status:** local project foundation only. Business modules (auth, contracts, approvals, Drive, PDF,
dashboard) are placeholders. Azure is not created yet. Planned files are placeholders, not completed features.

## Stack
Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui | Express + TypeScript | PostgreSQL + Prisma |
Google Drive API | PDFMake | Vitest + Supertest

## Architecture
Browser -> Next.js (`localhost:3000`) -> Express API (`localhost:4000`) -> Prisma -> PostgreSQL (`localhost:5432`).
Express calls Google Drive over HTTPS; PDFMake runs inside Express. The browser never touches PostgreSQL or private Google credentials.

## Prerequisites
Node.js 24 (`.nvmrc`), npm (do not mix npm/pnpm/yarn), Git, PostgreSQL, PowerShell on Windows.

## Run locally
Full steps are in [`docs/local-setup.md`](docs/local-setup.md). In short:

```powershell
cd backend;  npm install; npx prisma generate; npx prisma migrate dev; npm run dev
cd frontend; npm install; npm run dev
```
Check: `http://localhost:4000/api/health`, `http://localhost:4000/api/health/db`, then open `http://localhost:3000`.

## Environment variables
Copy `backend/.env.example` -> `backend/.env` and `frontend/.env.example` -> `frontend/.env.local`.
Only `NEXT_PUBLIC_API_BASE_URL` belongs in the frontend (it is public). Never commit `.env` files or
`backend/secrets/`.

## Repository structure
```
contract-forms-automation/
  README.md  .gitignore  .editorconfig  .nvmrc
  docs/        architecture, api-contract, database-schema, google-drive-setup,
               pdf-template-spec, local-setup, deployment-azure
  .github/workflows/   ci.yml, deploy-frontend.yml, deploy-backend.yml
  frontend/    Next.js app (src/app, components, features, lib, hooks, types, middleware.ts)
  backend/     Express API (src/{config,routes,controllers,services,repositories,middleware,schemas,utils,types,lib},
               prisma/, uploads/, generated/, tests/)
```

## Backend scripts (run from `backend/`)
`dev`, `build`, `start`, `typecheck`, `test`, `test:watch`, `db:generate`, `db:migrate`, `db:deploy`, `db:seed`, `db:studio`.

## Git workflow
Branch from `main` (`feature/auth`, `feature/contracts`, `feature/approvals`, `feature/google-drive-pdf`, `chore/...`).
Use pull requests and reviews; never push directly to `main`.

## Troubleshooting
| Problem | Check / fix |
|---|---|
| node or npm not recognized | Reopen PowerShell after install; verify PATH |
| Port 3000 or 4000 in use | Stop the other process or change the port and matching API URL / CORS origin |
| Prisma cannot find DATABASE_URL | Run Prisma commands from `backend/`; confirm `backend/.env` exists |
| Database connection refused | Start the PostgreSQL service; check port 5432 and credentials |
| CORS browser error | `FRONTEND_ORIGIN` must equal `http://localhost:3000`; no wildcard with credentials |
| Google Drive permission denied | Share the folder with the service account; confirm Drive API and folder ID |
| Secrets committed | Rotate/revoke immediately, purge from history, add to `.gitignore` |

## Definition of done
A teammate who did not create the repo can clone it, install dependencies, create their local database,
run migrations, start both apps, see the frontend reach the backend, and confirm `/api/health/db`.
