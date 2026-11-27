# Azure Deployment

## Verified repository configuration

- Backend workflow: `.github/workflows/deploy-backend.yml`
- Frontend workflow: `.github/workflows/deploy-frontend.yml`
- Verified frontend target: `contract-forms-frontend-261126`
- Backend settings script: `backend/deploy/azure/configure-app-settings.ps1`
- Deployment notes: `backend/deploy/azure/DEPLOYMENT-NOTES.txt`

Live application endpoints:

- Frontend: https://contract-forms-frontend-261126.azurewebsites.net
- Backend API: https://contract-forms-backend-261126.azurewebsites.net/api
- Login: https://contract-forms-frontend-261126.azurewebsites.net/login

Live liveness and database health checks returned HTTP 200 on 2026-11-27.

## Hosting model

- Frontend: Azure App Service Linux with Next.js server runtime
- Backend: Azure App Service Linux running `node dist/server.js`
- Database: Azure Database for PostgreSQL Flexible Server
- Documents: external Google Drive

## Backend deployment

The workflow runs generate, type-check, tests, build, and `npm prune --omit=dev`, packages backend dependencies and `dist`, and deploys on manual `workflow_dispatch`.

Required GitHub secret: `AZURE_BACKEND_PUBLISH_PROFILE`

Required GitHub variable: `AZURE_BACKEND_APP_NAME`

Before deployment:

1. Configure `DATABASE_URL` and `JWT_SECRET` in Key Vault.
2. Configure exact `FRONTEND_ORIGIN`.
3. Configure document upload policy variables.
4. Configure Google Drive variables or document it as unavailable.
5. Run `/api/health`.
6. Run `/api/health/db`.
7. Apply migrations as a controlled release step.

## Frontend deployment

The workflow runs lint/build and packages `.next`, `public`, dependencies, and configuration.

Required GitHub secret: `AZURE_FRONTEND_PUBLISH_PROFILE`

Required GitHub variables:

- `AZURE_FRONTEND_APP_NAME`
- `NEXT_PUBLIC_API_BASE_URL`

`NEXT_PUBLIC_API_BASE_URL` is build-time configuration and must use HTTPS outside local development.

For Azure's default hostname, no custom `APP_ORIGIN` is needed; the frontend recognizes `WEBSITE_HOSTNAME`. For a custom domain, set `APP_ORIGIN` to the exact HTTPS origin.

## App Service settings

Backend settings should include `NODE_ENV=production`, `FRONTEND_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, the three `DOCUMENT_*` settings, and Google Drive variables only when configured.

Use Key Vault references for secrets. Do not add database credentials or JWT secrets to GitHub variables or frontend build variables.

## Migration release

After backup and target verification:

```bash
npm run db:deploy
npm run db:generate
```

Do not deploy migration reset or destructive seed commands.

## Health and rollback

Verify liveness, database connectivity, frontend login, cookie forwarding, CORS, attachment configuration, PDF generation, and Google Drive when configured. Use the prior deployment package/artifact for rollback.
