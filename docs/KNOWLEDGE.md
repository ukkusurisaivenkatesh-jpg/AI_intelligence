# Knowledge representation

## Frames
The frame registry provides reusable Student, University, Programme, Eligibility, EntranceExam, Career and Skill templates with defaults and relationship maps.

## Semantic graph
The semantic network is generated from existing PostgreSQL-backed application data by a Python service. It connects the authenticated Student frame to subjects, entrance examinations, interests, skills, aptitude, qualification, and eligibility results; institutions to their programmes; programmes to verified subject and examination requirements and verified career pathways; careers to skills; and records to their source documents. It is read-only and requires no separate graph store.

The network is academic-year-aware. Programme requirement edges appear only when the programme and institution have complete verified provenance for that year. Pending programme records can still be displayed with their verification status, but their unverified subject and examination assertions are not represented as authoritative relationships. Student nodes and relationships are scoped to the authenticated user's own profile.

## Rules
Rules are JSON structures, not executable Python. Supported condition operators are `gte`, `lte`, `gt`, `lt`, `eq`, `neq`, `in`, `contains`, and `contains_all`, composed by `all`, `any`, and `not`.

## Conflict resolution
Active rules are filtered by effective and expiry dates. Forward chaining applies rules by priority and specificity. Backward chaining selects the highest-priority matching rule and evaluates its conditions.
