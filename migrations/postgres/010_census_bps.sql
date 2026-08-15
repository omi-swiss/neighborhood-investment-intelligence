CREATE TABLE IF NOT EXISTS standardized.census_bps_county_annual_observation (
  county_geoid char(5) NOT NULL,
  reporting_year smallint NOT NULL,
  county_name text,
  units_1 integer,
  units_2 integer,
  units_3_4 integer,
  units_5plus integer,
  valuation_1 bigint,
  valuation_2 bigint,
  valuation_3_4 bigint,
  valuation_5plus bigint,
  reported_units_1 integer,
  reported_units_2 integer,
  reported_units_3_4 integer,
  reported_units_5plus integer,
  source_vintage text NOT NULL,
  ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY (county_geoid, reporting_year)
);

CREATE INDEX IF NOT EXISTS census_bps_county_year_idx
  ON standardized.census_bps_county_annual_observation(reporting_year);
