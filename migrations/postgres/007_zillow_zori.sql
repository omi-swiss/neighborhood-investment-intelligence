CREATE TABLE IF NOT EXISTS standardized.zillow_zori_zip_observation (
  zip_code char(5) NOT NULL,
  reporting_month date NOT NULL,
  zori numeric NOT NULL,
  city text,
  state_abbr char(2),
  metro_name text,
  county_name text,
  publication_date date NOT NULL,
  source_vintage text NOT NULL,
  ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY (zip_code, reporting_month)
);

CREATE INDEX IF NOT EXISTS zillow_zori_zip_month_idx
  ON standardized.zillow_zori_zip_observation(reporting_month);
