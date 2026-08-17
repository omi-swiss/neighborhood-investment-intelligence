CREATE TABLE IF NOT EXISTS meta.opportunity_release_manifest (
  release_id VARCHAR PRIMARY KEY,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status VARCHAR NOT NULL,
  cohort_states JSON NOT NULL,
  cohort_years JSON NOT NULL,
  metric_geography_vintage VARCHAR NOT NULL,
  display_geography_vintage VARCHAR NOT NULL,
  source_run_ids JSON,
  artifact_manifest JSON,
  quality_finding_count BIGINT,
  error_message VARCHAR
);
