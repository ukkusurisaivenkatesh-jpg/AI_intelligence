# Database design

PostgreSQL is the structured source of truth. SQLite is supported for local development and tests.

Backend settings always load `backend/.env` using an absolute path, independent
of the command's working directory. `DATABASE_URL` is required; there is no
implicit SQLite fallback. Set `APP_ENV=development` with an explicit SQLite
URL for local development, `APP_ENV=test` for tests, and `APP_ENV=staging` with
a PostgreSQL URL plus distinct `STAGING_NEON_BRANCH_ID` and
`PRODUCTION_NEON_BRANCH_ID` values for staging. Production defaults to
`APP_ENV=production` and must receive its PostgreSQL URL through a protected
runtime environment or local `backend/.env`. Do not commit or copy `.env` into
Docker images.

Schema creation, demo seeding, and catalogue imports do not run at application
startup in staging or production. The catalogue import
function refuses production and verifies the connected Neon branch ID against
the configured staging branch before writing. Migration `0002` also requires
explicit staging environment and branch-ID session settings and checks the
actual Neon branch before changing schema or catalogue rows.

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

In development and tests, application startup can create missing tables and
seed isolated local data. Staging and production startup performs no DDL,
seeding, or catalogue import. The semantic-network endpoint reads existing
application records and does not create, synchronize, or delete graph data.
Do not apply
`backend/migrations/0002_catalogue_provenance.sql` blindly: first compare the
live schema with the migration and confirm the target branch. The current
staging schema already contains the migration columns, but there is no migration
ledger proving which command applied them. Do not rerun it solely to create a
history record. The migration is designed to preserve users, profiles, and
shortlists.

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

The catalogue importer contains 20 institutions and 16 programmes, retaining
their source and verification metadata. Development/test may seed isolated
local fixtures; a staging import is explicit, guarded, and must be preceded by
a fresh live-branch check. Pending criteria are excluded from public programme
results and cannot produce definitive eligibility, affordability, or
recommendations. No production migration, import, deployment, or push is
authorized by these instructions.

The semantic network is computed on demand from the existing PostgreSQL or
SQLite records. It does not require a separate graph database, graph-specific
environment variables, schema, or synchronization process. Student-specific
relationships are returned only to the authenticated student who owns that
profile. Unverified admission requirements are omitted from requirement edges.
