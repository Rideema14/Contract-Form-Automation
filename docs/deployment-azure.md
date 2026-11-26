# Azure Deployment and Configuration

## 1. Overview

The Contract Forms Automation application is deployed on **Microsoft Azure**.

The application uses separate hosting environments for the Next.js frontend and Express backend, while Azure Database for PostgreSQL provides centralized relational data storage.

Google Drive is integrated with the backend for private document storage, and PDFMake handles contract PDF generation.

The deployed architecture supports secure communication between application components over HTTPS.

## 2. Azure Architecture

The application uses the following deployment architecture:

```text
                 USERS
                   |
                   | HTTPS
                   v
          NEXT.JS FRONTEND
           AZURE APP SERVICE
                   |
                   | HTTPS REST API
                   v
          EXPRESS BACKEND
           AZURE APP SERVICE
                   |
          +--------+---------+
          |        |         |
          v        v         v
       PRISMA   GOOGLE     PDFMAKE
          |      DRIVE        |
          |       API         |
          v                   |
     AZURE DATABASE           |
     FOR POSTGRESQL           |
          |                   |
          +-------------------+
```

### Azure Components

| Component | Azure Service | Responsibility |
|---|---|---|
| Frontend | Azure App Service | Hosts the Next.js application. |
| Backend | Azure App Service | Hosts the Express REST API. |
| Database | Azure Database for PostgreSQL Flexible Server | Stores application data and relational records. |
| Application Configuration | App Service Application Settings | Stores environment-specific configuration and secrets. |
| Source Control | GitHub | Maintains application source code and deployment workflows. |
| CI/CD | GitHub Actions | Automates application deployment workflows. |

## 3. Application Deployment

### Frontend Deployment

The Next.js frontend is hosted through Azure App Service.

The frontend communicates with the backend using the configured API base URL.

The following environment variable identifies the backend API:

```env
NEXT_PUBLIC_API_BASE_URL=https://<backend-domain>/api
```

The production frontend uses the deployed backend address instead of a localhost URL.

### Backend Deployment

The Express backend is hosted separately through Azure App Service.

The backend handles:

- Authentication and authorization.
- Contract management.
- Approval workflows.
- Database operations through Prisma.
- Google Drive document operations.
- Contract PDF generation.
- Dashboard and administrative APIs.

The backend listens on the port provided by Azure:

```typescript
const port = process.env.PORT || 4000;
```

The application does not depend on hard-coded localhost URLs in production.

## 4. Database Configuration

The application uses Azure Database for PostgreSQL Flexible Server.

| Property | Configuration |
|---|---|
| Database Engine | PostgreSQL |
| Hosting | Azure Database for PostgreSQL Flexible Server |
| Database Name | `contract_automation` |
| Schema | `public` |
| ORM | Prisma |
| Connection | Backend through `DATABASE_URL` |
| Security | SSL-enabled database connection |

The Express backend connects to PostgreSQL through Prisma ORM.

The frontend never connects directly to the database.

Database credentials are maintained through secure backend environment configuration.

## 5. Environment Configuration

Environment-specific configuration is maintained separately for the frontend and backend.

### Backend Application Settings

The backend requires configuration for:

- `DATABASE_URL` – Azure PostgreSQL connection string.
- `JWT_SECRET` – Authentication signing secret.
- `FRONTEND_ORIGIN` – Deployed frontend origin.
- Google OAuth credentials and Drive configuration.
- Other application-specific settings required by the backend.

### Frontend Application Settings

The frontend requires:

- `NEXT_PUBLIC_API_BASE_URL` – Deployed backend API base URL.
- Other frontend configuration values required by the application.

Sensitive values are configured through Azure App Service Application Settings or the approved deployment secret store.

Secrets are never committed to GitHub or exposed through frontend environment variables.

## 6. Google Drive Integration

Google Drive is used for private supporting document and generated PDF storage.

The backend communicates with Google Drive through the Google Drive API.

OAuth credentials and refresh tokens are configured securely in the backend deployment environment.

The deployed application follows the same document access and authorization rules as the local environment.

Files are not made publicly accessible.

Refer to `google-drive-setup.md` for detailed Google Drive configuration and security information.

## 7. CI/CD and Deployment Workflow

GitHub is used for source control, and GitHub Actions supports automated deployment workflows.

The deployment workflow is organized into separate frontend and backend pipelines:

```text
GITHUB REPOSITORY
        |
        v
 CODE PUSH / APPROVED UPDATE
        |
        v
 GITHUB ACTIONS
        |
        +----------------------+
        |                      |
        v                      v
 FRONTEND WORKFLOW       BACKEND WORKFLOW
        |                      |
        v                      v
 AZURE APP SERVICE       AZURE APP SERVICE
        |                      |
        v                      v
 NEXT.JS APPLICATION     EXPRESS API
```

Deployment workflow files:

```text
.github/workflows/
    ├── deploy-frontend.yml
    └── deploy-backend.yml
```

The deployment process includes the following activities:

1. Retrieve the application source code.
2. Install the required dependencies.
3. Build the relevant application.
4. Deploy the frontend or backend to its respective Azure App Service.
5. Verify application availability and connectivity.

Deployment credentials and GitHub Actions secrets are managed securely.

## 8. Database Migration During Deployment

Prisma Migrate manages database schema changes.

The production migration command is:

```powershell
npx prisma migrate deploy
```

This command applies committed migrations that have not yet been applied to the target database.

The migration process follows these rules:

- Schema changes are developed and tested against an isolated development database.
- Migration files are committed to GitHub with the corresponding Prisma schema changes.
- Production migrations are reviewed before deployment.
- Migrations are applied through the controlled release process.
- Existing migrations are never modified after being applied to a shared environment.
- Database reset commands are never used against production data.

The application uses the existing PostgreSQL database and preserves its stored contract information during normal deployments.

## 9. Security Configuration

The Azure deployment follows the application's security requirements.

### Application Security

- HTTPS is used for communication between users and the application.
- Backend APIs are accessed through the deployed API domain.
- CORS is configured to allow the approved frontend origin.
- Authentication uses secure HttpOnly cookies.
- Production cookies use the Secure attribute and an appropriate SameSite policy.
- Backend authorization is enforced for protected operations.

### Database Security

- PostgreSQL connections use SSL.
- Database access is restricted through the configured Azure networking and firewall rules.
- Database credentials are stored securely.
- The frontend has no direct database access.

### Secret Management

- Production secrets are stored in secure deployment configuration.
- OAuth credentials are never exposed to the browser.
- JWT secrets and database connection strings are not committed to source control.

## 10. Monitoring and Cost Management

Azure Cost Management is used to monitor application infrastructure spending.

The main resources contributing to application costs include:

- Frontend App Service hosting.
- Backend App Service hosting.
- Azure Database for PostgreSQL Flexible Server.
- Database storage and backup usage.
- Network and data transfer usage where applicable.

### Cost Monitoring

The deployment cost depends on the selected Azure region, hosting plans, compute tiers, storage capacity, and actual usage.

The following practices are used for cost management:

- Monitor resource spending through Azure Cost Management.
- Configure a budget appropriate to the available Azure credits.
- Set budget alerts at selected spending thresholds.
- Review database and App Service resource usage.
- Avoid unnecessary resource scaling.
- Monitor resource consumption regularly.

A budget alert helps notify the team when spending approaches the configured budget. It does not automatically stop all Azure resources.

## 11. Azure Credit Expiration

Azure credits are subject to the eligibility, duration, and usage conditions of the selected subscription.

When the available credits expire or are exhausted:

- Continued hosting depends on the subscription's billing status and applicable service terms.
- Paid resources may incur charges if the subscription allows continued usage.
- Some services may be suspended or disabled depending on the subscription type.
- The team must review billing status and available credits before the expiration date.

To maintain application availability, the team should plan an appropriate billing arrangement or migrate resources before any subscription-related service interruption.

Database backups and application configuration should be maintained according to the project's data recovery requirements.

## 12. Deployment Verification

After deployment, the following checks are used to verify application availability:

| Verification | Expected Result |
|---|---|
| Frontend URL | Application loads successfully over HTTPS. |
| Backend Health API | Backend returns a successful health response. |
| Database Health API | Backend successfully connects to PostgreSQL. |
| Authentication | Authorized users can log in. |
| Role-Based Access | User permissions are enforced correctly. |
| Contract Management | Contract creation and retrieval work correctly. |
| Approval Workflow | Authorized approval operations work correctly. |
| Google Drive | Authorized document upload and retrieval work correctly. |
| PDF Generation | Contract PDFs are generated and stored successfully. |
| Dashboard | Dashboard information loads correctly. |

## 13. Source Code References

| Path | Purpose |
|---|---|
| `.github/workflows/deploy-frontend.yml` | Frontend deployment workflow. |
| `.github/workflows/deploy-backend.yml` | Backend deployment workflow. |
| `backend/prisma/schema.prisma` | Database schema definition. |
| `backend/prisma/migrations/` | Database migration history. |
| `backend/.env.example` | Backend environment configuration reference. |
| `frontend/.env.example` | Frontend environment configuration reference. |

## 14. Application Access

The deployed application is accessible through its configured HTTPS frontend address.

The backend API is hosted separately and accessed by the frontend through the configured API base URL.

The application uses the shared Azure PostgreSQL database and private Google Drive storage for its operational data and documents.