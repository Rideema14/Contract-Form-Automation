# 17. Setup Guide (Windows-friendly)

> The application code is not yet implemented. These instructions describe the intended setup once `package.json` files are created in Phase 1 implementation. Commands use PowerShell.

## Prerequisites
- Node.js LTS (version to be agreed; check with `node -v`)
- npm (bundled with Node)
- PostgreSQL 15+ (local install or Docker)
- Git
- VS Code (recommended)

## 1. Clone and Open
```powershell
git clone <REPOSITORY_URL>
cd contract-automation
```

## 2. Database
Create a local database (example uses `psql`):
```powershell
psql -U postgres -c "CREATE DATABASE contract_automation;"
```
Use your own credentials; never commit them.

## 3. Environment Files
```powershell
Copy-Item .env.example backend\.env
Copy-Item .env.example frontend\.env.local
```
Edit each file. Backend needs `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`. Frontend needs `NEXT_PUBLIC_API_BASE_URL`. Leave Google Drive values empty until Phase 3.

## 4. Backend
```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```
Backend expected at `http://localhost:5000`.

## 5. Frontend (new terminal)
```powershell
cd frontend
npm install
npm run dev
```
Frontend expected at `http://localhost:3000`.

## 6. Verify
Open the frontend URL. Check the backend health endpoint (to be added) at `http://localhost:5000/api/health`.

## Troubleshooting
- Port in use: change `PORT` or stop the other process.
- DB connection refused: confirm PostgreSQL service is running and `DATABASE_URL` is correct.
- PowerShell script policy error: run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Puppeteer download issues: see `PUPPETEER_EXECUTABLE_PATH` in `.env.example`.
