# AdmitWise AI

AdmitWise AI is a knowledge-based admission and career guidance system built around transparent, inspectable rules. It combines a responsive React/TypeScript interface with a FastAPI backend, PostgreSQL-backed semantic relationships, and a clearly labeled rule-based counselling demo. Counselling uses local deterministic rules; it does not call an external AI model.

The initial catalogue is source-tracked, but most programme admission criteria and fee records are pending verification. The system only treats complete, provenance-backed criteria for the requested academic year as definitive; unknown information stays unknown. Recommendations are not admission probabilities, and affordability is evaluated separately from academic eligibility.

See `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/KNOWLEDGE.md`, `docs/API.md`, and `docs/SETUP.md` for implementation details.
