CREATE TABLE IF NOT EXISTS standardized.fbi_cde_state_month_observation (
  state_abbr VARCHAR NOT NULL,
  reporting_month DATE NOT NULL,
  crime_category VARCHAR NOT NULL,
  offense_count BIGINT NOT NULL,
  clearance_count BIGINT,
  offense_rate_per_100k DOUBLE,
  clearance_rate_per_100k DOUBLE,
  population BIGINT,
  participating_population BIGINT,
  population_coverage_pct DOUBLE,
  source_vintage VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL,
  PRIMARY KEY (state_abbr, reporting_month, crime_category)
);

CREATE INDEX IF NOT EXISTS fbi_cde_state_month_idx
  ON standardized.fbi_cde_state_month_observation(reporting_month, crime_category);
