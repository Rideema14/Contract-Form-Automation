# Azure deployment

Filled in during the deployment phase, **after** the application is complete and tested locally.
Azure resources are intentionally not created during the foundation setup.

Planned: Resource Group; App Service Plan; two App Service Web Apps (Next.js frontend, Express backend);
Azure Database for PostgreSQL Flexible Server; App settings for secrets; GitHub Actions deploy workflows
(`.github/workflows/deploy-frontend.yml`, `deploy-backend.yml`).

To record: services and configuration, live application URL, cost estimate and budget alert,
behavior when credits expire, and the release step `npx prisma migrate deploy`.

Rules: backend listens on `process.env.PORT`; no hard-coded localhost URLs; exact-origin CORS; HTTPS with
Secure/HttpOnly/SameSite cookies; PostgreSQL restricted by firewall/private networking with SSL.
