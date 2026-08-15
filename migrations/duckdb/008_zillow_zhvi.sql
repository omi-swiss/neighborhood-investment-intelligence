CREATE TABLE IF NOT EXISTS standardized.zillow_zhvi_zip_observation (
  zip_code VARCHAR NOT NULL,
  reporting_month DATE NOT NULL,
  zhvi DOUBLE NOT NULL,
  city VARCHAR,
  state_abbr VARCHAR,
  metro_name VARCHAR,
  county_name VARCHAR,
  publication_date DATE NOT NULL,
  source_vintage VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL,
  PRIMARY KEY (zip_code, reporting_month)
);

CREATE INDEX IF NOT EXISTS zillow_zhvi_zip_month_idx
  ON standardized.zillow_zhvi_zip_observation(reporting_month);
