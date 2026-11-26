# 17. Setup Guide (Windows-Friendly)

## 1. Overview

The Contract Forms Automation application supports local development on Windows.

The frontend and backend can run locally while connecting to the configured PostgreSQL database hosted on Azure.

Google Drive integration is implemented at the backend level. However, actual file uploads require valid Google Drive credentials and an approved private folder configuration.

## 2. Prerequisites

Install the following tools:

| Tool | Requirement |
|---|---|
| Node.js | Version specified by the project, or compatible Node.js LTS |
| npm | Installed with Node.js |
| Git | Required for cloning and managing the repository |
| VS Code | Recommended code editor |
| PostgreSQL | Not required locally when using the configured shared Azure database |

Verify Node.js and npm:

```powershell
node -v
npm -v
```

Verify Git:

```powershell
git --version
```

## 3. Clone and Open the Repository

Clone the project repository using its Git URL:

```powershell
git clone <REPOSITORY_URL>
cd Contract-Form-Automation
```

The `develop` branch contains the current development source.

If necessary, switch to it:

```powershell
git checkout develop
git pull origin develop
```

Open the project in VS Code:

```powershell
code .
```

## 4. Configure Environment Variables

Create the local environment files from the provided examples:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

Update the environment files with the required configuration.

### Backend Configuration

The backend environment file is:

`backend/.env`

Configure the required values, including:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGIN` or the frontend origin variable used by the project
- Google Drive configuration variables, when enabled

The database connection must point to the authorized PostgreSQL database.

Use the connection settings supplied by the project administrator. Never commit database credentials or other secrets.

### Frontend Configuration

The frontend environment file is:

`frontend/.env.local`

Configure:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

This allows the locally running frontend to communicate with the backend API.

### Environment Security

- Never commit `.env` or `.env.local` files.
- Never share database passwords, JWT secrets, OAuth refresh tokens, or service-account keys.
- Do not expose private credentials through `NEXT_PUBLIC_` variables.
- Keep Google Drive credentials in backend-only environment settings.

## 5. Backend Setup

Open a PowerShell terminal in the project root.

Navigate to the backend:

```powershell
cd backend
```

Install dependencies:

```powershell
npm install
```

Generate the Prisma Client:

```powershell
npx prisma generate
```

Start the backend development server:

```powershell
npm run dev
```

The backend is expected to run at:

`http://localhost:4000`

**Important database safety note:**

The current development configuration uses the shared Azure PostgreSQL database. Do not run the following commands against that shared database:

- `npx prisma migrate dev`
- `npx prisma migrate reset`
- `npx prisma db push`
- `npx prisma db seed`

These commands can modify or overwrite shared database data.

Database schema changes must follow the team's approved migration process.

## 6. Frontend Setup

Open a second PowerShell terminal.

Navigate to the frontend:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Start the Next.js development server:

```powershell
npm run dev
```

The frontend is expected to run at:

`http://localhost:3000`

## 7. Verify the Application

Open the frontend in your browser:

`http://localhost:3000`

Verify the backend health endpoint:

`http://localhost:4000/api/health`

Verify the database connection:

`http://localhost:4000/api/health/db`

Check that:

1. The frontend loads successfully.
2. The backend responds to health checks.
3. The backend can connect to PostgreSQL.
4. Authentication works with authorized test credentials.
5. Users can access their permitted dashboards.
6. Contract forms and their saved data load correctly.

## 8. Google Drive Configuration

Google Drive credentials must be configured privately before real file operations can be verified.

The backend requires the appropriate authentication configuration, such as:

- OAuth client ID
- OAuth client secret
- OAuth refresh token
- Approved Drive folder configuration, where applicable

Keep these values in backend environment variables or the deployment secret store.

Until a real Google Drive account and folder are configured and verified, do not assume that uploads, downloads, or generated PDF storage in Drive have been successfully tested.

Refer to `google-drive-setup.md` for detailed configuration instructions.

## 9. Troubleshooting

### Port Already in Use

If port `3000` or `4000` is already occupied:

- Stop the process using that port, or
- Configure another available port and update the relevant environment settings.

### Database Connection Error

Check:

- The `DATABASE_URL` value.
- Database username and password.
- PostgreSQL server availability.
- SSL configuration.
- Azure database firewall and network access rules.

### Frontend Cannot Reach Backend

Check:

- The backend server is running.
- `NEXT_PUBLIC_API_BASE_URL` points to the correct backend address.
- The backend CORS configuration allows the frontend origin.
- Cookie and credential settings are configured correctly.

### Prisma Client Error

Regenerate the Prisma Client:

```powershell
npx prisma generate
```

### PowerShell Script Policy Error

If PowerShell blocks a required script, review the execution policy for your environment. If appropriate, use:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 10. Development Notes

- Run the frontend and backend in separate terminals.
- Use the `develop` branch as the current development source.
- Keep environment files and credentials private.
- Do not execute destructive database commands against the shared Azure database.
- Use the team's approved process for database migrations and seed updates.
- Test Google Drive operations only after the required credentials and private folder configuration are available.