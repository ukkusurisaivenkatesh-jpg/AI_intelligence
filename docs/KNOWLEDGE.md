# Knowledge representation

## Frames
The frame registry provides reusable Student, University, Programme, Eligibility, EntranceExam, Career and Skill templates with defaults and relationship maps.

## Semantic graph
Neo4j is used for `UNIVERSITY_OFFERS_PROGRAMME` and can be extended with student interests, subject requirements, careers and skills.

## Rules
Rules are JSON structures, not executable Python. Supported condition operators are `gte`, `lte`, `gt`, `lt`, `eq`, `neq`, `in`, `contains`, and `contains_all`, composed by `all`, `any`, and `not`.

## Conflict resolution
Active rules are filtered by effective and expiry dates. Forward chaining applies rules by priority and specificity. Backward chaining selects the highest-priority matching rule and evaluates its conditions.
