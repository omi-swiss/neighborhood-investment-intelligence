CREATE TABLE IF NOT EXISTS standardized.fhwa_nbi_county_observation (
  county_geoid VARCHAR NOT NULL, reporting_year INTEGER NOT NULL, bridge_count INTEGER NOT NULL,
  good_bridge_count INTEGER NOT NULL, fair_bridge_count INTEGER NOT NULL, poor_bridge_count INTEGER NOT NULL,
  deck_area_sq_m DOUBLE, ingestion_run_id VARCHAR NOT NULL, PRIMARY KEY (county_geoid, reporting_year)
);
