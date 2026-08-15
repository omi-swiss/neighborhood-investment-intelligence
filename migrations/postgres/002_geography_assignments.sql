CREATE TABLE IF NOT EXISTS standardized.geography_assignment (
  subject_geography_id text NOT NULL REFERENCES standardized.geography(geography_id),
  assigned_geography_id text NOT NULL REFERENCES standardized.geography(geography_id),
  assignment_type text NOT NULL,
  assignment_method text NOT NULL,
  assignment_vintage text NOT NULL,
  source_id text NOT NULL REFERENCES meta.source_catalog(source_id),
  confidence text NOT NULL,
  PRIMARY KEY(subject_geography_id, assigned_geography_id, assignment_type, assignment_vintage)
);

CREATE INDEX IF NOT EXISTS geography_assignment_subject_idx
  ON standardized.geography_assignment(subject_geography_id, assignment_type);
