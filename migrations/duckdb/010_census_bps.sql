CREATE TABLE IF NOT EXISTS standardized.census_bps_county_annual_observation (
  county_geoid VARCHAR NOT NULL,
  reporting_year INTEGER NOT NULL,
  county_name VARCHAR,
  units_1 INTEGER,
  units_2 INTEGER,
  units_3_4 INTEGER,
  units_5plus INTEGER,
  valuation_1 BIGINT,
  valuation_2 BIGINT,
  valuation_3_4 BIGINT,
  valuation_5plus BIGINT,
  reported_units_1 INTEGER,
  reported_units_2 INTEGER,
  reported_units_3_4 INTEGER,
  reported_units_5plus INTEGER,
  source_vintage VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL,
  PRIMARY KEY (county_geoid, reporting_year)
);

CREATE INDEX IF NOT EXISTS census_bps_county_year_idx
  ON standardized.census_bps_county_annual_observation(reporting_year);
