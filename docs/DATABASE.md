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

The application creates missing tables at startup. Existing records are preserved.

Neo4j is optional. Its current programme sync helper is not automatically invoked, so the graph page uses a relationship preview built from authenticated profile data and the SQL-backed programme and career APIs when Neo4j is unavailable. The UI identifies this fallback explicitly.
