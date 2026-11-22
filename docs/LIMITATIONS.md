# Limitations and data quality

- Demo records use synthetic institution names and are labelled `demo`. They must not be represented as official admissions information.
- No external LLM or paid API is required. The counsellor is deterministic and only returns engine-generated results.
- Neo4j is optional for local SQLite development; graph relationships remain mirrored from PostgreSQL when Neo4j is running.
- The included suitability model is transparent and configurable in code; it is not an admission probability.
- Salary and employment outcomes should only be added after a reliable, cited source is imported.
