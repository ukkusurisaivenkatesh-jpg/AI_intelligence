# Testing

Backend:
```powershell
cd backend
python -m pytest -q
```

Frontend:
```powershell
cd frontend
npm test
npm run build
```

The suite covers frame defaults, forward and backward chaining, rule expiry/priority, missing and conflicting evidence, eligibility statuses, recommendations, what-if operations and authenticated API behavior.
