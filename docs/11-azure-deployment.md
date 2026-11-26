# 11. Azure Deployment

## 1. Overview

The Contract Forms Automation application uses Microsoft Azure for application hosting and database infrastructure.

The deployment architecture separates the frontend, backend API, and PostgreSQL database. Application configuration and sensitive credentials are managed through environment-specific settings rather than committed to the source code.

## 2. Azure Architecture

| Component | Azure Service | Responsibility |
|---|---|---|
| Frontend | Azure App Service (Linux, Node.js) | Hosts the Next.js application and serves the user interface. |
| Backend | Azure App Service (Linux, Node.js) | Hosts the Express REST API and handles business logic, authentication, authorization, and integrations. |
| Database | Azure Database for PostgreSQL – Flexible Server | Stores users, contracts, approvals, attachments metadata, and audit records. |
| Secrets | App Service Application Settings / Azure Key Vault | Stores sensitive configuration and credentials. |
| Monitoring | App Service Logs / Azure Monitor | Supports application monitoring and troubleshooting. |

The frontend communicates with the backend through the configured API base URL. The backend connects to PostgreSQL and integrates with Google Drive for private document storage.

## 3. Environment Configuration

Application configuration is maintained separately for the frontend and backend.

### Backend Environment Variables

The backend requires environment-specific configuration, including:

- `NODE_ENV`
- `PORT`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `JWT_SECRET`
- Google Drive authentication and configuration variables
- Notification-related variables, where configured

### Frontend Environment Variables

The frontend uses:

- `NEXT_PUBLIC_API_BASE_URL`

This variable identifies the backend API base URL used by the Next.js application.

### Configuration Security

- Production secrets are configured through the deployment environment.
- Sensitive values must never be committed to GitHub.
- Database credentials, JWT secrets, OAuth credentials, and refresh tokens must remain backend-only.
- Public frontend environment variables must not contain private credentials.
- Access to deployment settings should be restricted to authorized team members.

## 4. Database Connection and Migrations

The application uses Azure Database for PostgreSQL – Flexible Server.

The backend connects to the configured PostgreSQL database through the `DATABASE_URL` environment variable.

### Database Security

- SSL must be enabled for the database connection.
- Firewall and networking rules should restrict database access to the backend application and approved development environments.
- Developer IP access should be limited to authorized users and removed when no longer required.
- Database credentials must be stored securely.

### Prisma Migrations

Prisma is used to manage database schema changes.

The production migration command is:

```bash
npx prisma migrate deploy
```

Production migration practices:

1. Review migration files before deployment.
2. Take a database backup before applying important schema changes.
3. Apply committed migrations using `prisma migrate deploy`.
4. Verify the database schema and application health after migration.

`prisma migrate dev` is intended for development environments and must not be used against the shared production database.

Database reset commands and unreviewed schema changes must not be run against production.

### Initial Data and Admin Account

Reference data and initial administrative access must be configured through the approved seed/setup process.

The initial Admin password must be supplied securely outside the source code and changed according to the organization's security policy.

## 5. Application Deployment

The application deployment follows a separated frontend and backend architecture.

### Frontend Deployment

The Next.js frontend is hosted on Azure App Service.

The deployment configuration includes:

- Production build configuration
- Required frontend environment variables
- Backend API base URL
- HTTPS access
- Correct API communication settings

### Backend Deployment

The Express backend is hosted on Azure App Service.

The backend deployment includes:

- Node.js runtime configuration
- Production environment settings
- Database connection configuration
- JWT authentication settings
- Google Drive integration credentials
- CORS configuration
- Health-check endpoints

The backend listens on the port supplied by the hosting environment, with the application's configured default used when appropriate.

### CORS Configuration

The backend CORS configuration must allow requests from the deployed frontend origin.

Credentials must be enabled where required for the application's HttpOnly cookie-based authentication.

Only trusted application origins should be allowed.

## 6. Deployment Verification

The following checks are used to verify application functionality after deployment.

| Area | Verification |
|---|---|
| Frontend | Application loads successfully over HTTPS. |
| Backend | API health endpoint responds successfully. |
| Database | Database health endpoint confirms connectivity. |
| Authentication | Users can log in and access their authorized dashboards. |
| Contract Management | Users can create and save contract drafts. |
| Approval Workflow | Submitted contracts follow the configured approval process. |
| Role-Based Access | Users cannot access operations outside their permissions. |
| PDF Generation | Contract PDFs can be generated through the backend. |
| File Management | Authorized attachment operations work through the application. |
| Dashboard | Contract counts and status information load correctly. |

## 7. Cost Management and Azure Credits

Azure resource usage should be monitored to keep the application within the available subscription credits and budget.

### Cost Management Practices

- Use the smallest suitable service tiers for the application's requirements.
- Monitor resource usage through Azure Cost Management.
- Configure budget alerts at the appropriate subscription or resource-group level.
- Review database, application hosting, storage, and monitoring costs.
- Stop or deallocate resources that are not required, where supported.
- Review usage regularly to avoid unexpected consumption.

### Credit Expiry

Azure subscription credits may have an expiry date or usage restrictions depending on the subscription type.

The team should track:

- Available credit balance
- Credit expiry date
- Resource consumption
- Subscription limitations
- Required actions when credits expire

If credits expire or become unavailable, the team must evaluate the available options, such as upgrading the subscription, transferring resources to an eligible subscription, or migrating the application infrastructure.

The application should not be assumed to remain operational if its hosting or database resources are suspended due to expired credits.

Exact credit amounts, expiry dates, and budget thresholds depend on the organization's Azure subscription.

## 8. Backup and Recovery

Database backups are important for protecting contract records, approval history, and application data.

The deployment environment should use the backup and restore capabilities supported by Azure Database for PostgreSQL.

The recovery process should include:

1. Identify the required recovery point.
2. Restore the database using the approved backup procedure.
3. Verify the restored database and schema.
4. Confirm backend connectivity.
5. Test authentication and contract workflows.
6. Verify that application data is accessible.

Database backups and recovery procedures should follow the organization's retention and security requirements.

## 9. Deployment and Operational Checklist

| Item | Description |
|---|---|
| Frontend hosting | Next.js application hosted on Azure App Service. |
| Backend hosting | Express API hosted on Azure App Service. |
| Database | Azure Database for PostgreSQL – Flexible Server. |
| Environment configuration | Application settings configured separately for frontend and backend. |
| Database security | SSL and restricted network access. |
| Migrations | Prisma production migrations. |
| Authentication | Secure JWT and HttpOnly cookie configuration. |
| CORS | Configured for the deployed frontend origin. |
| Monitoring | Application logs and health checks. |
| Cost management | Azure Cost Management and budget monitoring. |
| Backup | Database backup and recovery procedure. |
| File integration | Google Drive configuration and authorized backend access. |

## 10. Deployment Access

The application is accessible through its deployed frontend, which communicates with the backend API hosted on Azure.

The deployed application address is provided separately.