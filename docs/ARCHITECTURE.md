# Architecture

```text
React + TypeScript + React Flow + Recharts
                     |
                     v
FastAPI Routers -> Auth/RBAC -> Domain Services
                     |
          +----------+-----------+
          v                      v
     SQLAlchemy              Knowledge Engine
          |                 frames + rules
          v                 forward/backward
PostgreSQL / SQLite         explanations
          |
          v
Neo4j semantic graph
```

## Modules
- Student profile and academic data
- Frame registry and structured rule engine
- Semantic graph repository
- Eligibility and recommendation services
- What-if and career guidance
- Shortlist, comparison and deterministic counsellor
- Administrator CRUD and audit endpoints

## Eligibility flow
Missing data is never treated as a pass. The engine evaluates qualification, aggregate marks, required subjects, subject minima, entrance scores and verification status. It returns eligible, not eligible, conditionally eligible, insufficient information or criteria not verified.

## Recommendation flow
Mandatory eligibility is evaluated first. Eligible and conditionally eligible programmes are ranked using configurable academic, interest, aptitude, budget, location and career factors. Suitability scores are not admission probabilities.
