CREATE TABLE IF NOT EXISTS analytics.employment_center (
  reporting_year INTEGER NOT NULL,
  tract_geoid VARCHAR NOT NULL,
  geography_vintage VARCHAR NOT NULL,
  workplace_jobs DOUBLE NOT NULL,
  center_definition VARCHAR NOT NULL,
  source_vintage VARCHAR NOT NULL,
  built_at TIMESTAMP NOT NULL,
  PRIMARY KEY (reporting_year, tract_geoid, geography_vintage, center_definition)
);

CREATE TABLE IF NOT EXISTS analytics.tract_employment_accessibility (
  reporting_year INTEGER NOT NULL,
  tract_geoid VARCHAR NOT NULL,
  geography_vintage VARCHAR NOT NULL,
  nearest_center_tract_geoid VARCHAR NOT NULL,
  nearest_center_workplace_jobs DOUBLE NOT NULL,
  nearest_center_distance_km DOUBLE NOT NULL,
  center_definition VARCHAR NOT NULL,
  source_vintage VARCHAR NOT NULL,
  built_at TIMESTAMP NOT NULL,
  PRIMARY KEY (reporting_year, tract_geoid, geography_vintage, center_definition)
);

CREATE INDEX IF NOT EXISTS tract_employment_accessibility_year_idx
  ON analytics.tract_employment_accessibility(reporting_year, geography_vintage);
