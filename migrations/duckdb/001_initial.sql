CREATE SCHEMA IF NOT EXISTS meta;
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS standardized;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS quality;

CREATE TABLE IF NOT EXISTS meta.schema_migration (version VARCHAR PRIMARY KEY, applied_at TIMESTAMP NOT NULL);
CREATE TABLE IF NOT EXISTS meta.source_catalog (
  source_id VARCHAR PRIMARY KEY, publisher VARCHAR NOT NULL, dataset_name VARCHAR NOT NULL,
  source_url VARCHAR NOT NULL, geographic_coverage VARCHAR, geographic_resolution VARCHAR,
  temporal_coverage VARCHAR, update_frequency VARCHAR, license_terms VARCHAR,
  limitations VARCHAR, quality_rating VARCHAR, completeness_rating VARCHAR,
  documentation_url VARCHAR, last_successful_ingestion TIMESTAMP, expected_next_release DATE
);
CREATE TABLE IF NOT EXISTS meta.ingestion_run (
  run_id VARCHAR PRIMARY KEY, source_id VARCHAR NOT NULL, started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP, status VARCHAR NOT NULL, request_parameters JSON, record_count BIGINT,
  checksum_sha256 VARCHAR, error_message VARCHAR
);
CREATE TABLE IF NOT EXISTS raw.source_asset (
  asset_id VARCHAR PRIMARY KEY, run_id VARCHAR NOT NULL, source_url VARCHAR NOT NULL,
  retrieved_at TIMESTAMP NOT NULL, relative_path VARCHAR NOT NULL, checksum_sha256 VARCHAR NOT NULL,
  byte_count BIGINT NOT NULL, schema_version VARCHAR, license_metadata VARCHAR
);
CREATE TABLE IF NOT EXISTS standardized.geography (
  geography_id VARCHAR PRIMARY KEY, geography_type VARCHAR NOT NULL, geoid VARCHAR NOT NULL,
  name VARCHAR, parent_geography_id VARCHAR, valid_from DATE, valid_to DATE,
  geography_vintage VARCHAR NOT NULL, geometry_wkt VARCHAR, centroid_lon DOUBLE,
  centroid_lat DOUBLE, land_area_m2 BIGINT, water_area_m2 BIGINT, source_id VARCHAR NOT NULL,
  UNIQUE(geography_type, geoid, geography_vintage)
);
CREATE TABLE IF NOT EXISTS standardized.acs_observation (
  tract_geoid VARCHAR NOT NULL, reporting_year INTEGER NOT NULL, geography_vintage VARCHAR NOT NULL,
  metric_id VARCHAR NOT NULL, estimate DOUBLE, margin_of_error DOUBLE, numerator DOUBLE,
  denominator DOUBLE, universe VARCHAR, source_table VARCHAR NOT NULL, source_variable VARCHAR NOT NULL,
  derived_formula VARCHAR, observation_start DATE, observation_end DATE, publication_date DATE,
  source_vintage VARCHAR NOT NULL, ingestion_run_id VARCHAR NOT NULL,
  PRIMARY KEY(tract_geoid, reporting_year, geography_vintage, metric_id)
);
CREATE TABLE IF NOT EXISTS standardized.geography_crosswalk (
  from_geoid VARCHAR NOT NULL, from_vintage VARCHAR NOT NULL, to_geoid VARCHAR NOT NULL,
  to_vintage VARCHAR NOT NULL, method VARCHAR NOT NULL, weight DOUBLE NOT NULL,
  uncertainty_note VARCHAR, source_id VARCHAR NOT NULL,
  PRIMARY KEY(from_geoid, from_vintage, to_geoid, to_vintage, method)
);
CREATE TABLE IF NOT EXISTS quality.data_quality_result (
  result_id VARCHAR PRIMARY KEY, run_id VARCHAR, entity_type VARCHAR NOT NULL, entity_id VARCHAR NOT NULL,
  check_name VARCHAR NOT NULL, severity VARCHAR NOT NULL, status VARCHAR NOT NULL, detail VARCHAR,
  observed_at TIMESTAMP NOT NULL
);
