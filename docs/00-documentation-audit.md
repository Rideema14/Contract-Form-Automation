# Documentation Audit

## Audit scope

This inventory was produced from repository source, package manifests, Prisma files, seed scripts, GitHub workflows, and existing documentation.

## Documentation inventory

| Area | Canonical document | Status |
|---|---|---|
| Root overview | `../README.md` | Updated |
| Local setup | `17-setup-guide.md` | Verified and needs focused update |
| Database | `05-database-design.md` and `database-schema.md` | Source verified; overlapping text should be consolidated |
| API | `06-api-documentation.md` and `api-contract.md` | Overlapping; one canonical API guide required |
| Google Drive | `09-google-drive-integration.md` and `google-drive-setup.md` | Overlapping; implementation details need verification |
| PDF | `10-pdf-generation.md` and `pdf-template-spec.md` | Overlapping; implementation details need verification |
| Azure | `11-azure-deployment.md` and `deployment-azure.md` | Overlapping deployment guides |
| Architecture | `03-system-architecture.md` and `architecture.md` | Overlapping |
| Security/RBAC | `12-security-and-rbac.md` | Needs source verification |
| Testing | `13-testing-strategy.md` | Existing but should be reconciled with package scripts |
| QA | `18-comprehensive-qa-report.md` | Historical report; do not present older results as current |
| Assessment | `19-assessment-guide.md` | Added |
| File access | `20-file-access-security.md` | Added |

## Verified repository facts

- Backend package: Express 5.3, Prisma 6.19.3, PostgreSQL, Node scripts in `backend/package.json`.
- Frontend package: Next.js 16.4.6, React 19.3, TypeScript.
- Repository Node selection: `/.nvmrc` is `24`.
- Authentication: HTTP-only JWT cookie named `contract_token`; no bearer-token requirement in backend authentication middleware.
- Database: PostgreSQL datasource with migrations under `backend/prisma/migrations`.
- Seed: normal reference seed is localhost-only and development-only; demo user seed creates three intentionally demo accounts; showcase seed requires `ALLOW_SHOWCASE_SEED=true`.
- Deployment: GitHub Actions build/deploy workflows exist. The frontend workflow verifies app name `contract-forms-frontend-261126`.
- Health endpoints: `GET /api/health` and `GET /api/health/db`.

## Needs verification

- Live Azure frontend and backend reachability: **Verified** on 2026-11-27.
- Live Azure database connectivity: **Verified** through `GET /api/health/db` on 2026-11-27.
- Whether Google Drive credentials, folder, and OAuth state are configured in production.
- Whether production Google Drive credentials and folder ACLs are configured.
- Whether public email notification delivery is configured.
- Whether the historical QA report results still match the current branch.

## Secrets and safety

The repository contains `.env`-named files. Do not copy their values into documentation. Backend secrets include `DATABASE_URL`, `JWT_SECRET`, Google OAuth credentials, and Google application credentials. The frontend should receive only server-only API configuration and explicitly public demo values.
