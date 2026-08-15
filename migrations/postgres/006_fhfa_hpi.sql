CREATE TABLE IF NOT EXISTS standardized.fhfa_hpi_tract_observation (
  tract_geoid char(11) NOT NULL,
  reporting_year smallint NOT NULL,
  annual_change_pct numeric,
  hpi numeric,
  hpi_1990 numeric,
  hpi_2000 numeric,
  publication_date date NOT NULL,
  source_vintage text NOT NULL,
  ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY (tract_geoid, reporting_year)
);

CREATE INDEX IF NOT EXISTS fhfa_hpi_tract_year_idx
  ON standardized.fhfa_hpi_tract_observation(reporting_year);
