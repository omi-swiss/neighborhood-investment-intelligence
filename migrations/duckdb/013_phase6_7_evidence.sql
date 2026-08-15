ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS evidence_type VARCHAR;
ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS funding_status VARCHAR;
ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS committed_capex_usd DOUBLE;
ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS financing_status VARCHAR;
ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS actual_open_date DATE;
ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS secondary_source_url VARCHAR;
ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS source_document_date DATE;
ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS last_verified_date DATE;
ALTER TABLE standardized.private_investment_project
  ADD COLUMN IF NOT EXISTS confidence_level VARCHAR;

CREATE TABLE IF NOT EXISTS standardized.public_investment_project (
  project_id VARCHAR PRIMARY KEY,
  project_name VARCHAR NOT NULL,
  sponsor_name VARCHAR NOT NULL,
  project_type VARCHAR NOT NULL,
  project_status VARCHAR NOT NULL,
  funding_status VARCHAR NOT NULL,
  announcement_date DATE,
  approval_date DATE,
  construction_start_date DATE,
  expected_completion_date DATE,
  actual_completion_date DATE,
  total_project_cost_usd DOUBLE,
  proposed_funding_usd DOUBLE,
  budgeted_funding_usd DOUBLE,
  appropriated_funding_usd DOUBLE,
  awarded_funding_usd DOUBLE,
  spent_funding_usd DOUBLE,
  geography_type VARCHAR NOT NULL,
  geography_id VARCHAR NOT NULL,
  county_geoid VARCHAR,
  tract_geoid VARCHAR,
  latitude DOUBLE,
  longitude DOUBLE,
  coordinate_precision VARCHAR,
  primary_source_url VARCHAR NOT NULL,
  secondary_source_url VARCHAR,
  source_document_date DATE,
  last_verified_date DATE NOT NULL,
  verification_status VARCHAR NOT NULL,
  confidence_level VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS standardized.regulatory_policy (
  policy_id VARCHAR PRIMARY KEY,
  jurisdiction_type VARCHAR NOT NULL,
  state_fips VARCHAR NOT NULL,
  county_geoid VARCHAR,
  place_geoid VARCHAR,
  jurisdiction_name VARCHAR NOT NULL,
  policy_category VARCHAR NOT NULL,
  policy_dimension VARCHAR NOT NULL,
  policy_summary VARCHAR NOT NULL,
  effective_date DATE,
  expiration_date DATE,
  official_citation VARCHAR,
  official_source_url VARCHAR NOT NULL,
  last_verified_date DATE NOT NULL,
  review_status VARCHAR NOT NULL,
  confidence_level VARCHAR NOT NULL,
  applicability_note VARCHAR,
  ingestion_run_id VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS standardized.environmental_risk_observation (
  observation_id VARCHAR PRIMARY KEY,
  source_record_id VARCHAR,
  geography_type VARCHAR NOT NULL,
  geography_id VARCHAR NOT NULL,
  geography_vintage VARCHAR,
  risk_category VARCHAR NOT NULL,
  metric_id VARCHAR NOT NULL,
  value_numeric DOUBLE,
  value_text VARCHAR,
  unit VARCHAR,
  observation_date DATE,
  reference_period_start DATE,
  reference_period_end DATE,
  source_vintage VARCHAR NOT NULL,
  publication_date DATE,
  source_url VARCHAR NOT NULL,
  assignment_method VARCHAR NOT NULL,
  review_status VARCHAR NOT NULL,
  confidence_level VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL,
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL)
);
