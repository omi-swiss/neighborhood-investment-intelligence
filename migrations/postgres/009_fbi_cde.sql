CREATE TABLE IF NOT EXISTS standardized.fbi_cde_state_month_observation (
  state_abbr char(2) NOT NULL,
  reporting_month date NOT NULL,
  crime_category text NOT NULL,
  offense_count bigint NOT NULL,
  clearance_count bigint,
  offense_rate_per_100k numeric,
  clearance_rate_per_100k numeric,
  population bigint,
  participating_population bigint,
  population_coverage_pct numeric,
  source_vintage text NOT NULL,
  ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY (state_abbr, reporting_month, crime_category)
);

CREATE INDEX IF NOT EXISTS fbi_cde_state_month_idx
  ON standardized.fbi_cde_state_month_observation(reporting_month, crime_category);
