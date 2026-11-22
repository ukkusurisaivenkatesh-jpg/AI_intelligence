# API

Interactive OpenAPI documentation is available at `/docs`.

Key endpoints:
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/auth/me` — authenticated account and role
- `GET/PUT /api/students/me/profile`
- `GET /api/students/me/dashboard?academic_year=YYYY-YY`
- `GET /api/programmes?academic_year=YYYY-YY`
- `POST /api/eligibility/evaluate?academic_year=YYYY-YY`
- `GET /api/recommendations?academic_year=YYYY-YY`
- `POST /api/what-if`
- `GET/POST/DELETE /api/shortlist`
- `POST /api/compare`
- `GET /api/careers`
- `GET /api/knowledge/graph?academic_year=YYYY-YY` — authenticated, read-only semantic relationships from the current application database
- `GET /api/knowledge/rules`
- `POST /api/knowledge/forward-chain`
- `POST /api/knowledge/backward-chain`
- `POST /api/counsellor` — rule-based counselling demo. Accepts `message`, optional `academic_year`, and optional `profile_changes` matching profile fields; what-if changes are not saved. The response includes `engine: "rule-based-demo"`, `scenario`, `answer`, recommendations, missing profile information, and a source description. No external model is called.
- `GET /api/counsellor/history` — authenticated account's recent counselling history
- `GET /api/admin/*` — protected overview, catalogue/provenance inspection, and audit history
- `POST /api/admin/universities`, `POST /api/admin/rules` — protected writes; new institutions are always pending verification

The API allows cross-origin requests for the Vercel frontend and does not use cookie-based authentication; protected endpoints require a bearer token.

The knowledge graph response contains `available`, `academic_year`, `nodes`, and `edges`. Student-specific nodes and relationships are returned only for the authenticated account. Admission requirement edges are limited to verified criteria for the requested academic year.
