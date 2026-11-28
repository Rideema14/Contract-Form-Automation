# Contract Forms Automation

Contract Forms Automation is a full-stack application for creating contract forms, evaluating bidders, managing supporting documents, running sequential approval workflows, and producing PDF records.

<p align="center">
  <a href="YOUR_YOUTUBE_VIDEO_LINK">
    <img src="https://img.shields.io/badge/▶_WATCH_PROJECT_DEMO_ON_YOUTUBE-FF0000?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch Project Demo on YouTube" />
  </a>
</p>

<p align="center">
  **Watch the complete project walkthrough:**  
  Draft Creation • Contract Submission • Bidder Evaluation • Approval Workflows • PDF Generation • Dashboard Filtering
</p>

---

## Intended Users

- **SUBMITTER:** Creates and owns contracts, saves drafts, attaches documents, submits contracts, and resubmits returned contracts.
- **APPROVER:** Sees assigned approval work, reviews contract details, and approves, returns, or rejects a contract.
- **ADMIN:** Manages users and reference data, publishes form schemas, and has organization-wide contract visibility.

## Implemented Features

- Dynamic form schema draft, publish, and contract rendering.
- Contract drafts and returned-contract resubmission.
- Bidders, quotations, cost lines, and technical/commercial evaluations.
- Role-based contract and dashboard visibility.
- Sequential approval steps, decisions, history, notifications, and audit logs.
- Supporting attachments, PDF viewing/download, and final PDF package generation.
- Google Drive document storage.
- Admin user, approver, reference-data, and form-builder management.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.4.6, React 19.3, TypeScript 5, Tailwind CSS 4 |
| Backend | Node.js, Express 5.3, TypeScript 5.9 |
| Database | PostgreSQL with Prisma 6.19.3 |
| Authentication | HTTP-only `contract_token` JWT cookie and bcrypt password hashing |
| Documents | Multer, Google Drive API, PDFMake |
| Testing | Vitest and Supertest |
| Deployment | GitHub Actions and Microsoft Azure App Service |

The repository `/.nvmrc` selects Node.js 24. Deployment workflows currently use Node.js 24, while backend deployment notes discuss Node.js 22. Node.js 24 is the repository's command-tested convention.

## Architecture

```mermaid
flowchart LR
    Browser --> Frontend[Next.js Frontend]
    Frontend --> BFF[Next.js Same-Origin API Routes]
    BFF -->|HTTP Cookie| API[Express API]
    API --> Prisma[Prisma ORM]
    Prisma --> Postgres[(PostgreSQL)]
    API --> Drive[Google Drive API]
