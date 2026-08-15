CREATE TABLE IF NOT EXISTS standardized.qcew_county_observation (
  county_fips VARCHAR NOT NULL,
  reporting_year INTEGER NOT NULL,
  reporting_quarter INTEGER NOT NULL,
  industry_code VARCHAR NOT NULL,
  ownership_code VARCHAR NOT NULL,
  measure_type VARCHAR NOT NULL,
  estimate DOUBLE,
  is_disclosed BOOLEAN NOT NULL,
  publication_date DATE NOT NULL,
  source_vintage VARCHAR NOT NULL,
  ingestion_run_id VARCHAR NOT NULL,
  PRIMARY KEY (county_fips, reporting_year, reporting_quarter, industry_code, ownership_code, measure_type)
);

CREATE TABLE IF NOT EXISTS standardized.estimated_observation (
  geography_type VARCHAR NOT NULL,
  geography_id VARCHAR NOT NULL,
  metric_id VARCHAR NOT NULL,
  reference_period_start DATE NOT NULL,
  reference_period_end DATE NOT NULL,
  available_at DATE NOT NULL,
  estimate_type VARCHAR NOT NULL CHECK (estimate_type IN ('NOWCAST', 'FORECAST')),
  estimate DOUBLE NOT NULL,
  lower_bound DOUBLE,
  upper_bound DOUBLE,
  method_version VARCHAR NOT NULL,
  source_id VARCHAR NOT NULL,
  source_vintage VARCHAR,
  ingestion_run_id VARCHAR,
  PRIMARY KEY (geography_type, geography_id, metric_id, reference_period_end, estimate_type, method_version)
);

-- Correct the original ingest-time proxy dates. These are the release dates for the
-- 2019-2024 ACS 5-year vintages, not the date the local pipeline happened to run.
UPDATE standardized.acs_observation
SET publication_date = CASE reporting_year
  WHEN 2019 THEN DATE '2020-12-10'
  WHEN 2020 THEN DATE '2021-12-09'
  WHEN 2021 THEN DATE '2022-12-08'
  WHEN 2022 THEN DATE '2023-12-07'
  WHEN 2023 THEN DATE '2024-12-12'
  WHEN 2024 THEN DATE '2026-01-29'
  ELSE publication_date
END;

CREATE OR REPLACE VIEW analytics.observation_as_of AS
SELECT
  'census_acs5' AS source_id,
  'tract' AS geography_type,
  tract_geoid AS geography_id,
  metric_id,
  observation_start AS reference_period_start,
  observation_end AS reference_period_end,
  publication_date AS available_at,
  'OBSERVED' AS observation_type,
  'tract' AS geographic_resolution,
  estimate AS value,
  CAST(NULL AS DOUBLE) AS lower_bound,
  CAST(NULL AS DOUBLE) AS upper_bound,
  source_vintage,
  CAST(NULL AS VARCHAR) AS method_version,
  ingestion_run_id
FROM standardized.acs_observation
UNION ALL
SELECT
  'census_lodes' AS source_id,
  'tract' AS geography_type,
  tract_geoid AS geography_id,
  measure_type AS metric_id,
  make_date(reporting_year, 1, 1) AS reference_period_start,
  make_date(reporting_year, 12, 31) AS reference_period_end,
  CAST(NULL AS DATE) AS available_at,
  'OBSERVED' AS observation_type,
  'tract' AS geographic_resolution,
  estimate AS value,
  CAST(NULL AS DOUBLE) AS lower_bound,
  CAST(NULL AS DOUBLE) AS upper_bound,
  source_vintage,
  CAST(NULL AS VARCHAR) AS method_version,
  ingestion_run_id
FROM standardized.lodes_tract_observation
UNION ALL
SELECT
  'bls_qcew' AS source_id,
  'county' AS geography_type,
  county_fips AS geography_id,
  measure_type AS metric_id,
  make_date(reporting_year, (reporting_quarter - 1) * 3 + 1, 1) AS reference_period_start,
  last_day(make_date(reporting_year, reporting_quarter * 3, 1)) AS reference_period_end,
  publication_date AS available_at,
  'OBSERVED' AS observation_type,
  'county' AS geographic_resolution,
  estimate AS value,
  CAST(NULL AS DOUBLE) AS lower_bound,
  CAST(NULL AS DOUBLE) AS upper_bound,
  source_vintage,
  CAST(NULL AS VARCHAR) AS method_version,
  ingestion_run_id
FROM standardized.qcew_county_observation
WHERE is_disclosed
UNION ALL
SELECT
  source_id,
  geography_type,
  geography_id,
  metric_id,
  reference_period_start,
  reference_period_end,
  available_at,
  estimate_type AS observation_type,
  geography_type AS geographic_resolution,
  estimate AS value,
  lower_bound,
  upper_bound,
  source_vintage,
  method_version,
  ingestion_run_id
FROM standardized.estimated_observation;

CREATE INDEX IF NOT EXISTS qcew_county_observation_period_idx
  ON standardized.qcew_county_observation(reporting_year, reporting_quarter, measure_type);
