CREATE TABLE IF NOT EXISTS standardized.geography_assignment (
  subject_geography_id VARCHAR NOT NULL,
  assigned_geography_id VARCHAR NOT NULL,
  assignment_type VARCHAR NOT NULL,
  assignment_method VARCHAR NOT NULL,
  assignment_vintage VARCHAR NOT NULL,
  source_id VARCHAR NOT NULL,
  confidence VARCHAR NOT NULL,
  PRIMARY KEY(subject_geography_id, assigned_geography_id, assignment_type, assignment_vintage)
);

CREATE INDEX IF NOT EXISTS geography_assignment_subject_idx
  ON standardized.geography_assignment(subject_geography_id, assignment_type);
