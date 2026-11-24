# Local setup (every teammate)

Target: Windows 10/11 PowerShell. Node 24 (see `.nvmrc`), Git, PostgreSQL (port 5432), VS Code recommended.

1. Clone and install
```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd contract-forms-automation
cd frontend; npm install; cd ..
cd backend; npm install; cd ..
```
2. Create your own local database (inside `psql -U postgres`)
```sql
CREATE USER contract_user WITH PASSWORD 'REPLACE_WITH_LOCAL_PASSWORD';
CREATE DATABASE contract_automation OWNER contract_user;
GRANT ALL PRIVILEGES ON DATABASE contract_automation TO contract_user;
```
3. Create `backend/.env` from `backend/.env.example` and `frontend/.env.local` from `frontend/.env.example`. Never commit them or share real secrets.
4. Migrate (run from `backend/` so Prisma loads `backend/.env`)
```powershell
cd backend
npx prisma generate
npx prisma migrate dev
```
5. Run (three terminals): PostgreSQL service running; `cd backend; npm run dev` (expect "API listening on port 4000"); `cd frontend; npm run dev`.
6. Verify
```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://localhost:4000/api/health/db
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```
Open http://localhost:3000 - it should show "Backend is running".

## Useful commands (from `backend/`)
`npm run db:generate`, `npm run db:migrate`, `npm run db:studio`, `npm run typecheck`, `npm test`, `npm run build`.
Never run `prisma migrate reset` on a shared or production database.

## Provision a local reviewer account
Public registration is disabled. To create a local test reviewer, set `TEST_USER_EMAIL`,
`TEST_USER_PASSWORD` (8–128 characters), and `TEST_USER_ROLE=APPROVER` in `backend/.env`,
then run `npm run create:test-user` from `backend/`. The script only runs in development and
requires the local `contract_automation` database. `TEST_USER_ROLE` can also be omitted
(defaults to `SUBMITTER`); `ADMIN` is not available through this script. Existing accounts
are left unchanged.

## Troubleshooting
See the README troubleshooting table.
