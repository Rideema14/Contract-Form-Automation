# Architecture

```
USER BROWSER (localhost:3000)
  -> NEXT.JS FRONTEND (React + TypeScript)
  -> EXPRESS API (localhost:4000, /api)
       -> PRISMA ORM -> POSTGRESQL (localhost:5432)
       -> GOOGLE DRIVE API (HTTPS, private files, backend only)
       -> PDFMAKE (runs inside the Express backend)
```

Request flow: Browser -> Next.js frontend -> Express REST API -> Prisma -> PostgreSQL.
The backend separately calls Google Drive over HTTPS for private file storage.

Rules:
- The browser never connects directly to PostgreSQL or to Google Drive with private credentials.
- PDFMake runs inside the Express backend (`backend/src/services/pdf.service.ts`); it is not a separate service.
- One Git repository with separate `frontend/` and `backend/` apps. PostgreSQL is a local service, not a folder in the repo.
- Prisma schema and migrations live in `backend/prisma/`.
- Azure deployment happens only after local development and acceptance tests pass (see `deployment-azure.md`).

## Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui |
| Forms / validation | React Hook Form + Zod (client); repeat validation on the backend |
| Backend | Node.js, Express, TypeScript, REST API |
| Database | PostgreSQL (local now; Azure Database for PostgreSQL later) |
| ORM / migrations | Prisma |
| Authentication | JWT in secure HttpOnly cookies; bcrypt/Argon2 hashing |
| File storage | Google Drive API v3 (`googleapis`), private files, backend only |
| PDF | PDFMake inside Express |
| Security | Helmet, CORS, cookie-parser, express-rate-limit, server-side authorization |
| Testing | Vitest + Supertest |
| Source control | Git + GitHub; GitHub Actions later |
