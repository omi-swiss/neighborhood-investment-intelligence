CREATE TABLE IF NOT EXISTS standardized.fhfa_hpi_tract_observation (
  tract_geoid VARCHAR NOT NULL,
  reporting_year INTEGER NOT NULL,
  annual_change_pct DOUBLE,
  hpi DOUBLE,
  hpi_1990 DOUBLE,
  hpi_2000 DOUBLE,
  publication_date DATE NOT NULL,
  source_vintage VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL,
  PRIMARY KEY (tract_geoid, reporting_year)
);

CREATE INDEX IF NOT EXISTS fhfa_hpi_tract_year_idx
  ON standardized.fhfa_hpi_tract_observation(reporting_year);
