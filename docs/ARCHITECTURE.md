# Architecture

```text
React + TypeScript + React Flow + Recharts
                     |
                     v
FastAPI Routers -> Auth/RBAC -> Domain Services
          |          \
          v           v
     SQLAlchemy   Knowledge Engine
          |       frames + rules
          |       forward/backward
          v       explanations
  PostgreSQL / SQLite
          |
          v
 Python semantic-network builder
```

## Modules
- Student profile and academic data
- Frame registry and structured rule engine
- PostgreSQL-backed semantic-network service
- Eligibility and recommendation services
- What-if and career guidance
- Shortlist, comparison and rule-based counselling demo
- Administrator CRUD and audit endpoints

## Eligibility flow
Missing data is never treated as a pass. The engine evaluates qualification, aggregate marks, required subjects, subject minima, entrance scores and verification status. It returns eligible, not eligible, conditionally eligible, insufficient information or criteria not verified.

## Recommendation flow
Mandatory eligibility is evaluated first. Eligible and conditionally eligible programmes are ranked using configurable academic, interest, aptitude, budget, location and career factors. Suitability scores are not admission probabilities.

## Counselling demo
Counselling responses are generated locally from the student's saved profile, verified catalogue records, and deterministic eligibility and recommendation services. Optional what-if inputs are applied only to an in-memory profile copy and are not saved. Unknown criteria, fees, and career information remain unknown; no external model or inference provider is called.

## Semantic relationships
The knowledge-network endpoint derives nodes and relationships directly from the authenticated student's profile and existing institution, programme, career, and provenance records. It is read-only and uses the same PostgreSQL/SQLite connection as the rest of the application; there is no separate graph database or synchronization job. Admission-requirement relationships are included only when the programme and institution have complete verified provenance for the requested academic year.
