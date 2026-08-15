CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS meta;
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS standardized;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS quality;
CREATE TABLE IF NOT EXISTS meta.schema_migration (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS meta.source_catalog (
  source_id text PRIMARY KEY, publisher text NOT NULL, dataset_name text NOT NULL, source_url text NOT NULL,
  geographic_coverage text, geographic_resolution text, temporal_coverage text, update_frequency text,
  license_terms text, limitations text, quality_rating text, completeness_rating text, documentation_url text,
  last_successful_ingestion timestamptz, expected_next_release date
);
CREATE TABLE IF NOT EXISTS meta.ingestion_run (
  run_id uuid PRIMARY KEY, source_id text NOT NULL REFERENCES meta.source_catalog(source_id), started_at timestamptz NOT NULL,
  completed_at timestamptz, status text NOT NULL, request_parameters jsonb, record_count bigint, checksum_sha256 text, error_message text
);
CREATE TABLE IF NOT EXISTS raw.source_asset (
  asset_id uuid PRIMARY KEY, run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id), source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL, object_key text NOT NULL, checksum_sha256 text NOT NULL, byte_count bigint NOT NULL,
  schema_version text, license_metadata text
);
CREATE TABLE IF NOT EXISTS standardized.geography (
  geography_id text PRIMARY KEY, geography_type text NOT NULL, geoid text NOT NULL, name text,
  parent_geography_id text, valid_from date, valid_to date, geography_vintage text NOT NULL,
  geometry geometry(MultiPolygon, 4326), centroid geometry(Point, 4326), land_area_m2 bigint, water_area_m2 bigint,
  source_id text NOT NULL REFERENCES meta.source_catalog(source_id), UNIQUE(geography_type, geoid, geography_vintage)
);
CREATE TABLE IF NOT EXISTS standardized.acs_observation (
  tract_geoid char(11) NOT NULL, reporting_year smallint NOT NULL, geography_vintage text NOT NULL, metric_id text NOT NULL,
  estimate numeric, margin_of_error numeric, numerator numeric, denominator numeric, universe text, source_table text NOT NULL,
  source_variable text NOT NULL, derived_formula text, observation_start date, observation_end date, publication_date date,
  source_vintage text NOT NULL, ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY (tract_geoid, reporting_year, geography_vintage, metric_id)
);
CREATE INDEX IF NOT EXISTS acs_observation_tract_year_idx ON standardized.acs_observation(tract_geoid, reporting_year);
