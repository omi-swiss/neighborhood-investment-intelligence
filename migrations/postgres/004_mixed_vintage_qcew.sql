CREATE TABLE IF NOT EXISTS standardized.qcew_county_observation (
  county_fips char(5) NOT NULL,
  reporting_year smallint NOT NULL,
  reporting_quarter smallint NOT NULL CHECK (reporting_quarter BETWEEN 1 AND 4),
  industry_code text NOT NULL,
  ownership_code text NOT NULL,
  measure_type text NOT NULL,
  estimate numeric,
  is_disclosed boolean NOT NULL,
  publication_date date NOT NULL,
  source_vintage text NOT NULL,
  ingestion_run_id uuid NOT NULL REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY (county_fips, reporting_year, reporting_quarter, industry_code, ownership_code, measure_type)
);

CREATE TABLE IF NOT EXISTS standardized.estimated_observation (
  geography_type text NOT NULL,
  geography_id text NOT NULL,
  metric_id text NOT NULL,
  reference_period_start date NOT NULL,
  reference_period_end date NOT NULL,
  available_at date NOT NULL,
  estimate_type text NOT NULL CHECK (estimate_type IN ('NOWCAST', 'FORECAST')),
  estimate numeric NOT NULL,
  lower_bound numeric,
  upper_bound numeric,
  method_version text NOT NULL,
  source_id text NOT NULL REFERENCES meta.source_catalog(source_id),
  source_vintage text,
  ingestion_run_id uuid REFERENCES meta.ingestion_run(run_id),
  PRIMARY KEY (geography_type, geography_id, metric_id, reference_period_end, estimate_type, method_version)
);

CREATE INDEX IF NOT EXISTS qcew_county_observation_period_idx
  ON standardized.qcew_county_observation(reporting_year, reporting_quarter, measure_type);
