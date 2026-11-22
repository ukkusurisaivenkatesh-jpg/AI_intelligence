# Database design

PostgreSQL is the structured source of truth. SQLite is supported for local development and tests.

Main tables:
- `users`: authentication and RBAC
- `student_profiles`: saved student facts
- `universities`: institution metadata and verification status
- `programmes`: programme facts and institution-specific criteria
- `rules`: versionable structured inference rules
- `careers`: career guidance and roadmaps
- `shortlists`: student saved programmes
- `chat_messages`: persisted counselling questions and grounded responses
- `audit_logs`: administrative changes

The application creates missing tables at startup. It does not alter existing
PostgreSQL tables. Apply `backend/migrations/0002_catalogue_provenance.sql` once
to an existing PostgreSQL database before deploying this version. The migration
preserves users, profiles, and shortlists. Legacy demo universities, programmes,
fees, and inference rules are marked unavailable or inactive rather than being
silently treated as real or being deleted.

University and programme catalogue rows carry verification status, source
metadata, and an academic year. Each programme row represents one programme
offering/admission cycle; create a separate row for each cycle rather than
overwriting old criteria. Fees have separate source and year metadata. Only
`VERIFIED` admission criteria with a complete provenance record and an exact
requested academic-year match can produce eligibility. Eligibility is academic;
affordability is reported separately and uses only verified fees from the same
academic year.

Career guidance also carries source and verification metadata. Legacy sample
career guidance is not exposed through public career endpoints until its
official source and academic-year record are verified.

The progressive official-source catalogue currently seeds 20 institutions and
16 programme offerings from university pages. One institution identity is
verified; the programme admission criteria and fee records are pending because
the accessible official pages either omit the current cycle or contain older or
conflicting cycle details. Pending facts are kept for administrator review and
are excluded from public catalogue results and eligibility decisions.

Entrance requirements in `entrance_requirements` may specify `minimum_score`
and/or `maximum_rank`. Student `entrance_scores` may remain numeric for score
checks or store an object such as `{"rank": 1200, "score": 85}` when both
measures are collected. Additional conditions use JSON objects with `label`,
`field`, `operator`, and `value`; supported operators are `eq`, `gte`, `gt`,
`lte`, `lt`, `in`, `contains`, and `has_any_key`. Missing facts or unsupported
condition formats produce insufficient information, never a pass.

The demo catalogue is intentionally no longer seeded. Until an institution and
its programme criteria are entered and verified from official sources, the
catalogue and recommendation results remain empty or report insufficient
information. No production database was migrated by this code change; deployers
must apply the SQL migration to their own database.

Neo4j is optional. On startup, the backend synchronizes source-backed institutions
and programmes, including their verification metadata and institution, programme,
and fee source relationships. If Neo4j is unavailable or misconfigured, startup
continues with a warning and the graph API reports the service as unavailable;
the frontend identifies its SQL-backed relationship preview explicitly. Set
`NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` in the backend environment when a
reachable graph service is available; never commit credentials in `.env` files.
