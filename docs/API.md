# API

Interactive OpenAPI documentation is available at `/docs`.

Key endpoints:
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/auth/me` — authenticated account and role
- `GET/PUT /api/students/me/profile`
- `GET /api/students/me/dashboard`
- `GET /api/programmes`
- `POST /api/eligibility/evaluate`
- `GET /api/recommendations`
- `POST /api/what-if`
- `GET/POST/DELETE /api/shortlist`
- `POST /api/compare`
- `GET /api/careers`
- `GET /api/knowledge/graph`
- `GET /api/knowledge/rules`
- `POST /api/knowledge/forward-chain`
- `POST /api/knowledge/backward-chain`
- `POST /api/counsellor` — grounded answer and persisted user question
- `GET /api/counsellor/history` — authenticated account's recent counselling history
- `GET/POST /api/admin/*`

The API allows cross-origin requests for the Vercel frontend and does not use cookie-based authentication; protected endpoints require a bearer token.
