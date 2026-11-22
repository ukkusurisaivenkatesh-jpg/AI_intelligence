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
- `audit_logs`: administrative changes

Neo4j mirrors universities, programmes and semantic relationships. It is optional at runtime and the API reports a connection message if unavailable.
