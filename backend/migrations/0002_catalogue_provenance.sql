BEGIN;

DO $staging_guard$
DECLARE
    actual_branch TEXT := current_setting('neon.branch_id', true);
    staging_branch TEXT := current_setting('app.staging_neon_branch_id', true);
    production_branch TEXT := current_setting('app.production_neon_branch_id', true);
BEGIN
    IF current_setting('app.environment', true) IS DISTINCT FROM 'staging' THEN
        RAISE EXCEPTION 'Migration requires app.environment=staging';
    END IF;
    IF staging_branch IS NULL OR production_branch IS NULL THEN
        RAISE EXCEPTION 'Migration requires explicit staging and production Neon branch IDs';
    END IF;
    IF actual_branch IS NULL OR actual_branch <> staging_branch OR actual_branch = production_branch THEN
        RAISE EXCEPTION 'Connected Neon branch is not the configured staging branch';
    END IF;
END
$staging_guard$;

ALTER TABLE universities
    ADD COLUMN IF NOT EXISTS institution_type VARCHAR,
    ADD COLUMN IF NOT EXISTS state VARCHAR,
    ADD COLUMN IF NOT EXISTS city VARCHAR,
    ADD COLUMN IF NOT EXISTS recognition_info TEXT,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS source_title TEXT,
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR NOT NULL DEFAULT 'PENDING_VERIFICATION',
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS academic_year VARCHAR,
    ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP,
    ADD COLUMN IF NOT EXISTS data_notes TEXT;

ALTER TABLE universities
    ALTER COLUMN data_status SET DEFAULT 'unverified';

ALTER TABLE programmes
    ADD COLUMN IF NOT EXISTS degree_type VARCHAR,
    ADD COLUMN IF NOT EXISTS specialization VARCHAR,
    ADD COLUMN IF NOT EXISTS duration_text VARCHAR,
    ADD COLUMN IF NOT EXISTS minimum_qualification VARCHAR,
    ADD COLUMN IF NOT EXISTS additional_admission_conditions JSON,
    ADD COLUMN IF NOT EXISTS admission_route VARCHAR,
    ADD COLUMN IF NOT EXISTS counselling_authority VARCHAR,
    ADD COLUMN IF NOT EXISTS criteria_complete BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS academic_year VARCHAR,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS source_title TEXT,
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR NOT NULL DEFAULT 'PENDING_VERIFICATION',
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP,
    ADD COLUMN IF NOT EXISTS data_notes TEXT,
    ADD COLUMN IF NOT EXISTS fee_academic_year VARCHAR,
    ADD COLUMN IF NOT EXISTS fee_source_url TEXT,
    ADD COLUMN IF NOT EXISTS fee_source_title TEXT,
    ADD COLUMN IF NOT EXISTS fee_verification_status VARCHAR NOT NULL DEFAULT 'PENDING_VERIFICATION',
    ADD COLUMN IF NOT EXISTS fee_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS fee_last_updated TIMESTAMP,
    ADD COLUMN IF NOT EXISTS fee_data_notes TEXT,
    ADD COLUMN IF NOT EXISTS other_academic_fees JSON;

ALTER TABLE programmes
    ALTER COLUMN data_status SET DEFAULT 'unverified';

ALTER TABLE careers
    ADD COLUMN IF NOT EXISTS related_qualifications JSON,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS source_title TEXT,
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR NOT NULL DEFAULT 'PENDING_VERIFICATION',
    ADD COLUMN IF NOT EXISTS academic_year VARCHAR,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP,
    ADD COLUMN IF NOT EXISTS data_notes TEXT;

UPDATE universities
SET verification_status = 'UNAVAILABLE',
    data_notes = 'Retired legacy demo record; not supported by official-source verification.',
    last_updated = CURRENT_TIMESTAMP
WHERE verification_status = 'PENDING_VERIFICATION'
  AND (data_status = 'demo' OR website LIKE '%example.test%');

UPDATE careers
SET verification_status = 'UNAVAILABLE',
    data_notes = 'Retired legacy demo guidance; not supported by official-source verification.',
    last_updated = CURRENT_TIMESTAMP
WHERE verification_status = 'PENDING_VERIFICATION';

UPDATE programmes
SET verification_status = 'UNAVAILABLE',
    fee_verification_status = 'UNAVAILABLE',
    criteria_complete = FALSE,
    data_notes = 'Retired legacy demo record; not supported by official-source verification.',
    fee_data_notes = 'Legacy demo fee; not supported by official-source verification.',
    last_updated = CURRENT_TIMESTAMP,
    fee_last_updated = CURRENT_TIMESTAMP
WHERE verification_status = 'PENDING_VERIFICATION'
  AND (
      data_status = 'demo'
      OR source LIKE '%demo%'
      OR source LIKE '%Illustrative%'
  );

UPDATE rules
SET active = FALSE
WHERE id LIKE 'demo-%'
   OR source LIKE '%demo%'
   OR source LIKE '%Illustrative%';

COMMIT;
