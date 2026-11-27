# Seed and Demo Data

## Normal reference seed

Script: `backend/prisma/seed.ts`

Command:

```powershell
Set-Location backend
$env:NODE_ENV="development"
npm run db:seed
```

This seed creates or updates:

- Strategic Sourcing department
- Professional Services category
- Technology Services vendor type
- USD currency
- Northstar Cloudworks and Blue Cedar Systems sample vendors

It refuses databases not targeting localhost and refuses non-development execution.

## Demo users

Script: `backend/prisma/seed-demo-users.ts`

Command:

```powershell
Set-Location backend
npm run seed:demo
```

It upserts:

- `admin@example.com` - ADMIN
- `approver@example.com` - APPROVER
- `submitter@example.com` - SUBMITTER

The script prints demo passwords at execution time. The credentials are intentionally demo-only; do not use them in production.

## Showcase seed

Script: `backend/prisma/seed-showcase.ts`

Command:

```powershell
Set-Location backend
$env:ALLOW_SHOWCASE_SEED="true"
npm run seed:showcase
```

Safety requirements:

- `ALLOW_SHOWCASE_SEED=true` is mandatory.
- Demo users must already exist.
- A published form schema must exist.
- The script prints the target database description.

The script creates showcase departments, categories, vendor types, vendors, approvers, bidders, quotations, evaluations, approval workflows, decisions, notifications, and audit data. It is intended for assessment and demonstration use only.

Showcase template statuses include draft, pending approval, approved, returned, rejected, two-level rejection, and an attachment demonstration contract.

Optional PDF upload:

```powershell
$env:SHOWCASE_SEED_UPLOAD_PDF="false"
npm run seed:showcase
```

Set `SHOWCASE_SEED_UPLOAD_PDF=true` or leave it unspecified to attempt the optional PDF upload when Drive is configured.

## Idempotency

The normal seed and demo user scripts use upserts. The showcase seed uses upserts and fixed showcase IDs for repeatable data setup. It should not be treated as a reset tool and it does not delete unrelated data.

## Production safety

Do not run seed scripts against production unless an authorized database owner explicitly approves an isolated demonstration database. Seeds create known demo credentials and showcase records. Demo credentials must never become production accounts.
