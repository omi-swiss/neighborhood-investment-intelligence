CREATE TABLE IF NOT EXISTS standardized.fhwa_nbi_county_observation (
  county_geoid char(5) NOT NULL, reporting_year smallint NOT NULL, bridge_count integer NOT NULL,
  good_bridge_count integer NOT NULL, fair_bridge_count integer NOT NULL, poor_bridge_count integer NOT NULL,
  deck_area_sq_m numeric, ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id), PRIMARY KEY (county_geoid, reporting_year)
);
