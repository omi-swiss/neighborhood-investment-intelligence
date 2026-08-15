CREATE TABLE IF NOT EXISTS standardized.lodes_tract_observation (
  tract_geoid char(11) NOT NULL,
  reporting_year smallint NOT NULL,
  geography_vintage text NOT NULL,
  measure_type text NOT NULL,
  job_type text NOT NULL,
  estimate numeric NOT NULL,
  source_state char(2) NOT NULL,
  source_vintage text NOT NULL,
  ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY(tract_geoid, reporting_year, geography_vintage, measure_type, job_type, source_state)
);

CREATE TABLE IF NOT EXISTS standardized.lodes_tract_flow (
  workplace_tract_geoid char(11) NOT NULL,
  residence_tract_geoid char(11) NOT NULL,
  reporting_year smallint NOT NULL,
  geography_vintage text NOT NULL,
  job_type text NOT NULL,
  total_jobs numeric NOT NULL,
  source_state char(2) NOT NULL,
  source_vintage text NOT NULL,
  ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY(workplace_tract_geoid, residence_tract_geoid, reporting_year, geography_vintage, job_type, source_state)
);

CREATE INDEX IF NOT EXISTS lodes_tract_observation_year_idx
  ON standardized.lodes_tract_observation(reporting_year, measure_type);
CREATE INDEX IF NOT EXISTS lodes_tract_flow_year_idx
  ON standardized.lodes_tract_flow(reporting_year, workplace_tract_geoid);
