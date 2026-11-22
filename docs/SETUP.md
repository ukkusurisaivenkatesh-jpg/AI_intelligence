# Setup

## Local development

Backend:
```powershell
cd backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:
```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. API documentation is at http://localhost:8000/docs.

## Docker
```powershell
docker compose up --build
```

Demo accounts:
- Student: `student@admitwise.demo` / `Student123!`
- Administrator: `admin@admitwise.demo` / `Admin123!`

The application starts with SQLite unless `DATABASE_URL` is configured. PostgreSQL and Neo4j are used by Docker Compose.
