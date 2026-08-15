CREATE TABLE IF NOT EXISTS analytics.employment_center (
  reporting_year smallint NOT NULL,
  tract_geoid char(11) NOT NULL,
  geography_vintage text NOT NULL,
  workplace_jobs numeric NOT NULL,
  center_definition text NOT NULL,
  source_vintage text NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reporting_year, tract_geoid, geography_vintage, center_definition)
);

CREATE TABLE IF NOT EXISTS analytics.tract_employment_accessibility (
  reporting_year smallint NOT NULL,
  tract_geoid char(11) NOT NULL,
  geography_vintage text NOT NULL,
  nearest_center_tract_geoid char(11) NOT NULL,
  nearest_center_workplace_jobs numeric NOT NULL,
  nearest_center_distance_km numeric NOT NULL,
  center_definition text NOT NULL,
  source_vintage text NOT NULL,
  built_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reporting_year, tract_geoid, geography_vintage, center_definition)
);

CREATE INDEX IF NOT EXISTS tract_employment_accessibility_year_idx
  ON analytics.tract_employment_accessibility(reporting_year, geography_vintage);
