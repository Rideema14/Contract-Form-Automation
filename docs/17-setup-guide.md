# Local Development Setup

## Prerequisites

- Node.js 24 (the repository `/.nvmrc`)
- npm
- Git
- PostgreSQL
- Optional Google OAuth credentials or service account

Windows PowerShell commands are provided below.

## 1. Clone

```powershell
git clone https://github.com/Rideema14/Contract-Form-Automation.git
Set-Location Contract-Form-Automation
```

## 2. Backend

```powershell
Set-Location backend
Copy-Item .env.example .env
npm ci
npm run db:generate
npm run dev
```

Required backend variables:

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret, minimum 32 characters |
| `NODE_ENV` | No | defaults to `development` |
| `PORT` | No | defaults to `4000` |
| `FRONTEND_ORIGIN` | No | exact comma-separated CORS origins |
| `JWT_EXPIRES_IN` | No | backend login token lifetime |
| `DOCUMENT_ALLOWED_EXTENSIONS` | For uploads | comma-separated file extensions |
| `DOCUMENT_MAX_FILE_SIZE_BYTES` | For uploads | maximum bytes per file |
| `DOCUMENT_MAX_FILE_COUNT` | For uploads | maximum files per request |
| `GOOGLE_DRIVE_AUTH_MODE` | For Drive | `oauth` or `service-account` |
| `GOOGLE_OAUTH_CLIENT_ID` | OAuth only | OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | OAuth only | OAuth client secret |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | OAuth only | approved refresh token |
| `GOOGLE_DRIVE_FOLDER_ID` | OAuth/folder or service account | optional OAuth app folder; service-account folder required |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service account only | path to the JSON key file |

Backend scripts:

```powershell
npm run dev
npm run build
npm start
npm run typecheck
npm test
npm run db:generate
npm run db:migrate
npm run db:deploy
npm run db:seed
npm run db:studio
```

The backend listens on `http://localhost:4000` by default.

Health endpoints:

- `GET http://localhost:4000/api/health`
- `GET http://localhost:4000/api/health/db`

## 3. Frontend

Open a second terminal:

```powershell
Set-Location frontend
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Frontend variables:

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | server-only backend URL ending in `/api`; preferred |
| `NEXT_PUBLIC_API_BASE_URL` | public/build-time fallback backend URL |
| `APP_ORIGIN` | public origin for custom production domains |
| `NEXT_PUBLIC_DEMO_*` | optional public demo login values; never production secrets |

Frontend scripts:

```powershell
npm run dev
npm run build
npm start
npm run lint
npm test
```

The frontend default URL is `http://localhost:3000`.

## 4. Database

Use a dedicated local or disposable PostgreSQL database.

Development migration workflow:

```powershell
Set-Location backend
npm run db:generate
npm run db:migrate
```

Production migration workflow:

```powershell
npm run db:deploy
```

Do not run `npx prisma migrate reset`, `npx prisma db push`, or seed scripts against shared or production databases.

## 5. Seeds

Reference seed:

```powershell
$env:NODE_ENV="development"
npm run db:seed
```

The normal seed refuses non-localhost database hosts.

Demo users:

```powershell
npm run seed:demo
```

This upserts the demo users and prints demo passwords. It is not safe for production.

Showcase seed:

```powershell
$env:ALLOW_SHOWCASE_SEED="true"
npm run seed:showcase
```

The showcase seed requires demo users and a published form schema. Set `SHOWCASE_SEED_UPLOAD_PDF=false` to skip optional PDF/Drive upload.

## 6. Troubleshooting

- **Database connection failure:** verify `DATABASE_URL`, PostgreSQL availability, firewall/network access, and TLS.
- **401 or expired session:** ensure `JWT_SECRET` is consistent and `contract_token` is accepted by browser/CORS configuration.
- **CORS failure:** set `FRONTEND_ORIGIN` to the exact frontend scheme and host.
- **Frontend cannot reach backend:** verify `API_BASE_URL` is HTTPS in production and ends in `/api`.
- **Prisma client failure:** run `npm run db:generate`.
- **Upload unavailable:** verify all three `DOCUMENT_*` variables and Google Drive credentials.
