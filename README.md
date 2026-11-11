# Contract Forms Automation

> **Current status: setup and documentation stage.** The repository structure and technical documentation are complete. **No application features are implemented yet**, and Google Drive and Azure are **not configured**.

## Introduction
A web application that lets staff create contract forms, route them through a sequential approval workflow, store supporting documents in Google Drive, and generate a completed contract PDF. Built by three full-stack developers as a company assessment deliverable.

## Features (planned)
- User/Admin authentication and role-based access control
- Contract form creation, editing and draft saving
- Dashboard (total, draft, pending approval, approved, rejected/returned) and searchable contract register
- Vendors with type autocomplete; repeatable bidders and quotations
- Technical and commercial evaluations; cost estimates with Excel upload
- Sequential approval (approve / return / reject with comments), history and audit trail
- Notifications to the next approver
- Supporting document uploads in Google Drive; authorized view/download
- PDF generation following the company's sample form
- Azure deployment

## Technology Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js, React, JavaScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express.js, REST APIs |
| Database | PostgreSQL, Prisma ORM |
| Validation / forms | Zod, React Hook Form |
| Integrations | Google Drive API, Puppeteer, Microsoft Azure |

## Repository Structure
```text
contract-automation/
├── frontend/    Next.js app (app/, components/, services/, hooks/, lib/, schemas/, styles/)
├── backend/     Express API (src/modules/*, prisma/, tests/)
├── docs/        Project documentation and Mermaid diagrams
├── .env.example Placeholder environment variables
└── README.md
```
Full detail: [docs/04-folder-structure.md](docs/04-folder-structure.md).

## Local Setup
Full guide: [docs/17-setup-guide.md](docs/17-setup-guide.md). Summary (Windows PowerShell):
1. Install Node.js LTS, PostgreSQL and Git.
2. Clone the repository.
3. Create a local database.
4. Copy environment files and fill in values.
5. Install dependencies and run backend and frontend.

> `package.json` files do not exist yet; they will be created when implementation starts.

## Environment Configuration
```powershell
Copy-Item .env.example backend\.env
Copy-Item .env.example frontend\.env.local
```
Replace every `<PLACEHOLDER>` with your own values. Never commit real secrets.

## Database Setup (once implemented)
```powershell
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

## Running the Application (once implemented)
```powershell
# Terminal 1
cd backend; npm run dev      # http://localhost:5000
# Terminal 2
cd frontend; npm run dev     # http://localhost:3000
```

## Testing
Strategy and checklist: [docs/13-testing-strategy.md](docs/13-testing-strategy.md). Test commands will be added when the test tooling is agreed (`npm test` in `backend/`).

## Documentation
| Doc | Topic |
|---|---|
| [01](docs/01-project-overview.md) | Project overview |
| [02](docs/02-requirements.md) | Requirements and open questions |
| [03](docs/03-system-architecture.md) | System architecture |
| [04](docs/04-folder-structure.md) | Folder structure |
| [05](docs/05-database-design.md) | Database design |
| [06](docs/06-api-documentation.md) | API documentation (proposed) |
| [07](docs/07-user-workflow.md) | User workflow |
| [08](docs/08-approval-workflow.md) | Approval workflow |
| [09](docs/09-google-drive-integration.md) | Google Drive integration |
| [10](docs/10-pdf-generation.md) | PDF generation |
| [11](docs/11-azure-deployment.md) | Azure deployment |
| [12](docs/12-security-and-rbac.md) | Security and RBAC |
| [13](docs/13-testing-strategy.md) | Testing strategy |
| [14](docs/14-team-responsibilities.md) | Team responsibilities |
| [15](docs/15-four-phase-implementation-plan.md) | Four-phase plan |
| [16](docs/16-git-workflow.md) | Git workflow |
| [17](docs/17-setup-guide.md) | Setup guide |

Diagram sources are in [docs/diagrams/](docs/diagrams/).

## Current Implementation Status
| Area | Status |
|---|---|
| Repository structure | Done |
| Documentation | Done (draft; pending company clarifications) |
| Backend / Frontend code | Not started |
| Database schema | Proposed only |
| Azure deployment | Not started |
| Google Drive integration | Not started |
| PDF generation | Blocked on company sample PDF |
