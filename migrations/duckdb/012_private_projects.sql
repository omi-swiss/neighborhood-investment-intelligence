CREATE TABLE IF NOT EXISTS standardized.private_investment_project (
  project_id VARCHAR PRIMARY KEY,
  company_name VARCHAR NOT NULL,
  project_name VARCHAR,
  investment_type VARCHAR NOT NULL,
  project_status VARCHAR NOT NULL,
  announcement_date DATE,
  expected_open_date DATE,
  capex_usd DOUBLE,
  expected_jobs INTEGER,
  county_geoid VARCHAR NOT NULL,
  latitude DOUBLE NOT NULL,
  longitude DOUBLE NOT NULL,
  coordinate_precision VARCHAR NOT NULL,
  primary_source_url VARCHAR NOT NULL,
  verification_status VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL
);
