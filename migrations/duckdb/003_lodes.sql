CREATE TABLE IF NOT EXISTS standardized.lodes_tract_observation (
  tract_geoid VARCHAR NOT NULL,
  reporting_year INTEGER NOT NULL,
  geography_vintage VARCHAR NOT NULL,
  measure_type VARCHAR NOT NULL,
  job_type VARCHAR NOT NULL,
  estimate DOUBLE NOT NULL,
  source_state VARCHAR NOT NULL,
  source_vintage VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL,
  PRIMARY KEY(tract_geoid, reporting_year, geography_vintage, measure_type, job_type, source_state)
);

CREATE TABLE IF NOT EXISTS standardized.lodes_tract_flow (
  workplace_tract_geoid VARCHAR NOT NULL,
  residence_tract_geoid VARCHAR NOT NULL,
  reporting_year INTEGER NOT NULL,
  geography_vintage VARCHAR NOT NULL,
  job_type VARCHAR NOT NULL,
  total_jobs DOUBLE NOT NULL,
  source_state VARCHAR NOT NULL,
  source_vintage VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL,
  PRIMARY KEY(workplace_tract_geoid, residence_tract_geoid, reporting_year, geography_vintage, job_type, source_state)
);

CREATE INDEX IF NOT EXISTS lodes_tract_observation_year_idx
  ON standardized.lodes_tract_observation(reporting_year, measure_type);

CREATE INDEX IF NOT EXISTS lodes_tract_flow_year_idx
  ON standardized.lodes_tract_flow(reporting_year, workplace_tract_geoid);
