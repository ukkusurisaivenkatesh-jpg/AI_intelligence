# Setup

## Local development

The backend always loads configuration from `backend/.env`, regardless of
whether the command is started at the repository root or inside `backend`.
`DATABASE_URL` is mandatory; the backend never silently selects SQLite.
Keep the existing staging file private and do not replace it with a local
development configuration.

The recommended local setup uses the isolated PostgreSQL service in
Docker Compose. It sets `APP_ENV=development` and passes a local-only database
URL to the API container; application startup creates/seeds only that local
database. It does not use or write to the configured Neon staging branch.

```powershell
docker compose up --build
```

Open http://localhost:5173. The Vite development server proxies `/api` to
http://localhost:8000. In Compose, nginx proxies `/api` to the API container.
The API documentation is at http://localhost:8000/docs.

For running the backend directly on Windows, first start local Postgres, then
set the local-only environment variables in the same PowerShell
window. These process-level values override `backend/.env` and must point to
local services, never Neon:

```powershell
$env:APP_ENV = "development"
$env:DATABASE_URL = "postgresql+psycopg://admitwise:admitwise@localhost:5432/admitwise"
```

From the repository root:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload
```

From the backend directory, use the same local-only environment variables:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Run the frontend in another terminal:

```powershell
Set-Location frontend
npm ci
npm run dev
```

Local development seeds demo authentication accounts and the source-tracked
catalogue into the local database. Catalogue admission criteria and fees still
remain pending unless the records contain complete verified provenance.
Never use demo credentials outside a local development database.

## Tests and production build

```powershell
Set-Location backend
python -m pytest
Set-Location ..\frontend
npm test
npm run build
```

Backend tests use an isolated in-memory SQLite database. They do not connect to
Neon or modify staging/production.

## Counselling demo

The counselling interface is a deterministic, rule-based demo, not a live AI
model. It uses profile values and the application's catalogue, eligibility,
recommendation, and career services. What-if values are evaluated on a
temporary profile copy and are not saved. No Hugging Face configuration, API
key, or external inference service is required.

## Database and staging

The `backend/.env` file is the configured Neon staging environment and is
private, ignored by Git and excluded from the Docker build. Keep production and
staging branch IDs distinct. Do not copy production student data to staging.
Before any staging write, verify the live branch ID; the catalogue importer
refuses production and unknown branches. Schema changes require a separate
review and backup. See [DATABASE.md](./DATABASE.md) for the existing migration
state and branch safeguards.

No deployment or Git push is performed by these setup steps.
