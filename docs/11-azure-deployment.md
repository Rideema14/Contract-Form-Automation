# 11. Azure Deployment

> **Status:** Planned (Phase 2). **Nothing has been deployed. No Azure resources exist yet.** No prices, URLs or credentials are stated here; subscription details are pending (CL-17).

## Proposed Setup (to be validated against the company's subscription)
| Component | Proposed Azure service |
|---|---|
| Frontend (Next.js) | Azure App Service (Linux, Node) or Static Web Apps with SSR support |
| Backend (Express) | Azure App Service (Linux, Node) |
| Database | Azure Database for PostgreSQL (Flexible Server) |
| Secrets | App Service application settings (optionally Azure Key Vault) |
| Logs | App Service logs / Azure Monitor |
Final service choice is a decision for the team and company.

## Environment Variables
All variables in `.env.example` are configured as App Service settings. Backend: `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `JWT_SECRET`, Drive and notification variables. Frontend: `NEXT_PUBLIC_API_BASE_URL`. Secrets are never committed.

## Database Connection and Migrations
- `DATABASE_URL` points to the Azure PostgreSQL server; SSL required.
- Firewall/network rules allow only the backend App Service (and approved developer IPs temporarily).
- Migrations run with `npx prisma migrate deploy` during deployment, never `migrate dev`, and only after taking a backup.
- Seed (`seed.js`) runs once for reference data and the first Admin; the initial Admin password is supplied out-of-band.

## Deployment Steps (outline)
1. Create resource group, PostgreSQL server/database, two App Services.
2. Configure environment settings.
3. Deploy backend; run `prisma migrate deploy`.
4. Deploy frontend; set API URL; configure CORS.
5. Smoke test: login, create draft, submit, approve.
6. Record actual resource names and URLs in this document **after** they exist.
Optional later: CI/CD via GitHub Actions.

## Budget Alerts and Credit Expiry
- Create an Azure **budget** with alert thresholds on the resource group/subscription, notifying all three developers and the company contact.
- Document: credit amount, **credit expiry date**, and what happens to the services at expiry (stop, delete, migrate). These values are to be filled in once known (CL-17).
- Prefer the smallest suitable tiers; stop or deallocate unused resources.

## Checklist (to be completed in Phase 2)
- [ ] Subscription access confirmed
- [ ] Budget alert created
- [ ] Credit expiry date recorded
- [ ] Resources created and tagged
- [ ] Migrations applied
- [ ] Smoke test passed
- [ ] Rollback/backup procedure documented
