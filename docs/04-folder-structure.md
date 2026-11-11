# 04. Folder Structure

```text
contract-automation/
├── frontend/                Next.js application
│   ├── public/              Static assets
│   └── src/
│       ├── app/             App Router pages (one folder per route)
│       │   ├── login/       Login page
│       │   ├── dashboard/   Status totals and contract register
│       │   ├── forms/       Create, view and edit contract forms
│       │   ├── drafts/      User's saved drafts
│       │   ├── approvals/   Approver inbox, decision screens, history
│       │   ├── documents/   Document viewing and downloads
│       │   └── admin/       User, role and reference data management
│       ├── components/      Reusable React components
│       │   ├── layout/      Navbar, sidebar, page shells
│       │   ├── dashboard/   Status cards, register table, filters
│       │   ├── forms/       Form sections, repeatable bidder rows, autocomplete
│       │   ├── approvals/   Decision panel, history timeline
│       │   ├── documents/   Upload widget, document list
│       │   └── ui/          shadcn/ui primitives
│       ├── services/        API client functions (one file per backend module)
│       ├── hooks/           Custom React hooks
│       ├── lib/             Utilities (API client, auth helpers, formatters)
│       ├── schemas/         Zod schemas used with React Hook Form
│       └── styles/          Global CSS and Tailwind layers
├── backend/
│   ├── src/
│   │   ├── config/          Env loading, Prisma client, Drive client, constants
│   │   ├── middleware/      Auth, RBAC, ownership, validation, error handling, uploads
│   │   ├── modules/         Feature modules (see below)
│   │   ├── routes/          Central route registration (`/api/...`)
│   │   ├── utils/           Shared helpers (errors, pagination, logger)
│   │   ├── validators/      Shared Zod schemas used across modules
│   │   └── app.js           Express app setup
│   ├── prisma/              schema.prisma, migrations/, seed.js
│   └── tests/               Backend tests
├── docs/                    Project documentation and diagrams
├── .env.example
├── .gitignore
└── README.md
```

## Backend Modules
Each module is a folder that will contain `*.routes.js`, `*.controller.js`, `*.service.js`, and `*.validators.js`.

| Module | Responsibility | Owner |
|---|---|---|
| `auth` | Login, token issue/verify, current user | Dev 1 |
| `users` | User profile and management logic | Dev 1 |
| `dashboard` | Status counts, register queries | Dev 1 |
| `admin` | Admin-only management, reference data | Dev 1 |
| `forms` | Contract form CRUD, drafts, submission | Dev 2 |
| `vendors` | Vendor records, vendor type autocomplete | Dev 2 |
| `bidders` | Bidders and quotation records | Dev 2 |
| `evaluations` | Technical and commercial evaluations | Dev 2 |
| `cost-estimates` | Cost breakdown lines, Excel estimate uploads | Dev 2 |
| `approvals` | Sequential workflow, decisions, history | Dev 3 |
| `audit` | Audit log writing and reading | Dev 3 |
| `notifications` | Next-approver notifications | Dev 3 |
| `documents` | Upload, metadata, authorized download | Dev 3 |
| `pdf` | Puppeteer templates and PDF generation | Dev 3 |

## Conventions
- Files: `kebab-case.js`; React components: `PascalCase.jsx`.
- No business logic in routes or components; put it in services.
- Cross-module calls go through the other module's service, never its Prisma queries.
