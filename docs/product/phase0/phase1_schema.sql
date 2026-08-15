BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.workspace (
    workspace_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.app_user (
    user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_subject text NOT NULL UNIQUE,
    email text,
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    disabled_at timestamptz
);

CREATE TABLE IF NOT EXISTS app.workspace_member (
    workspace_id uuid NOT NULL REFERENCES app.workspace(workspace_id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES app.app_user(user_id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'analyst', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS app.data_source (
    source_id text PRIMARY KEY,
    publisher text NOT NULL,
    dataset_name text NOT NULL,
    source_url text NOT NULL,
    documentation_url text,
    native_geographic_level text,
    update_frequency text,
    license_terms text,
    limitations text,
    expected_next_release date,
    last_successful_ingestion timestamptz
);

CREATE TABLE IF NOT EXISTS app.ingestion_run (
    ingestion_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id text NOT NULL REFERENCES app.data_source(source_id),
    started_at timestamptz NOT NULL,
    completed_at timestamptz,
    status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    record_count bigint CHECK (record_count IS NULL OR record_count >= 0),
    checksum_sha256 text,
    error_summary text
);

CREATE TABLE IF NOT EXISTS app.data_release (
    release_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status text NOT NULL CHECK (status IN ('building', 'validated', 'active', 'retired', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    activated_at timestamptz,
    build_version text NOT NULL,
    notes text
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_data_release
    ON app.data_release (status)
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS app.geographic_area (
    area_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    geographic_level text NOT NULL
        CHECK (geographic_level IN ('nation', 'state', 'metro', 'county', 'place', 'zip', 'tract')),
    geoid text NOT NULL,
    geography_vintage text NOT NULL,
    name text NOT NULL,
    parent_area_id uuid REFERENCES app.geographic_area(area_id),
    state_abbr char(2),
    normalized_search_text text NOT NULL,
    geometry geometry(MultiPolygon, 4326),
    representative_point geometry(Point, 4326),
    valid_from date,
    valid_to date,
    source_id text NOT NULL REFERENCES app.data_source(source_id),
    UNIQUE (geographic_level, geoid, geography_vintage),
    CHECK (geometry IS NULL OR ST_IsValid(geometry))
);

CREATE INDEX IF NOT EXISTS geographic_area_geometry_gist
    ON app.geographic_area USING gist (geometry);
CREATE INDEX IF NOT EXISTS geographic_area_point_gist
    ON app.geographic_area USING gist (representative_point);
CREATE INDEX IF NOT EXISTS geographic_area_search_idx
    ON app.geographic_area (geographic_level, normalized_search_text);

CREATE TABLE IF NOT EXISTS app.area_metric (
    metric_id text PRIMARY KEY,
    display_name text NOT NULL,
    description text NOT NULL,
    unit text NOT NULL,
    favorable_direction text NOT NULL
        CHECK (favorable_direction IN ('higher', 'lower', 'target', 'context_only')),
    default_format text NOT NULL,
    valid_min double precision,
    valid_max double precision,
    methodology_version text NOT NULL,
    is_filterable boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    CHECK (valid_min IS NULL OR valid_max IS NULL OR valid_min <= valid_max)
);

CREATE TABLE IF NOT EXISTS app.area_metric_history (
    release_id uuid NOT NULL REFERENCES app.data_release(release_id),
    area_id uuid NOT NULL REFERENCES app.geographic_area(area_id),
    metric_id text NOT NULL REFERENCES app.area_metric(metric_id),
    reference_start date NOT NULL,
    reference_end date NOT NULL,
    available_at date,
    observation_type text NOT NULL
        CHECK (observation_type IN ('observed', 'derived', 'nowcast', 'forecast', 'system_default')),
    source_geographic_level text NOT NULL,
    value double precision,
    margin_of_error double precision,
    lower_bound double precision,
    upper_bound double precision,
    source_id text NOT NULL REFERENCES app.data_source(source_id),
    source_vintage text,
    method_version text,
    ingestion_run_id uuid REFERENCES app.ingestion_run(ingestion_run_id),
    quality_status text NOT NULL
        CHECK (quality_status IN ('reliable', 'caution', 'unreliable', 'not_available', 'not_assessed')),
    PRIMARY KEY (release_id, area_id, metric_id, reference_end, observation_type, source_id),
    CHECK (reference_start <= reference_end),
    CHECK (lower_bound IS NULL OR upper_bound IS NULL OR lower_bound <= upper_bound),
    CHECK (observation_type = 'observed' OR method_version IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS area_metric_history_lookup_idx
    ON app.area_metric_history (release_id, area_id, metric_id, reference_end DESC);

CREATE TABLE IF NOT EXISTS app.data_quality_result (
    quality_result_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    release_id uuid REFERENCES app.data_release(release_id),
    ingestion_run_id uuid REFERENCES app.ingestion_run(ingestion_run_id),
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    check_code text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    status text NOT NULL CHECK (status IN ('pass', 'fail', 'not_assessed')),
    detail text,
    observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_quality_entity_idx
    ON app.data_quality_result (entity_type, entity_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS app.score_definition (
    score_definition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    stable_key text NOT NULL UNIQUE,
    name text NOT NULL,
    description text NOT NULL,
    scope text NOT NULL CHECK (scope IN ('area', 'property')),
    workspace_id uuid REFERENCES app.workspace(workspace_id) ON DELETE CASCADE,
    created_by uuid REFERENCES app.app_user(user_id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.score_version (
    score_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    score_definition_id uuid NOT NULL REFERENCES app.score_definition(score_definition_id),
    version integer NOT NULL CHECK (version > 0),
    status text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
    normalization_method text NOT NULL,
    minimum_coverage double precision NOT NULL CHECK (minimum_coverage BETWEEN 0 AND 1),
    exclusion_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
    risk_penalties jsonb NOT NULL DEFAULT '[]'::jsonb,
    authored_by uuid REFERENCES app.app_user(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (score_definition_id, version)
);

CREATE TABLE IF NOT EXISTS app.score_component_definition (
    score_version_id uuid NOT NULL REFERENCES app.score_version(score_version_id) ON DELETE CASCADE,
    category_key text NOT NULL,
    metric_id text NOT NULL REFERENCES app.area_metric(metric_id),
    weight double precision NOT NULL CHECK (weight > 0),
    favorable_direction text NOT NULL CHECK (favorable_direction IN ('higher', 'lower', 'target')),
    is_required boolean NOT NULL DEFAULT false,
    transform_config jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (score_version_id, category_key, metric_id)
);

CREATE TABLE IF NOT EXISTS app.area_score (
    release_id uuid NOT NULL REFERENCES app.data_release(release_id),
    area_id uuid NOT NULL REFERENCES app.geographic_area(area_id),
    score_version_id uuid NOT NULL REFERENCES app.score_version(score_version_id),
    category_key text NOT NULL,
    score_value double precision,
    coverage double precision NOT NULL CHECK (coverage BETWEEN 0 AND 1),
    status text NOT NULL CHECK (status IN ('scored', 'insufficient_data', 'excluded')),
    cohort_type text NOT NULL,
    cohort_id text NOT NULL,
    cohort_size integer NOT NULL CHECK (cohort_size >= 0),
    calculated_at timestamptz NOT NULL,
    PRIMARY KEY (release_id, area_id, score_version_id, category_key, cohort_type, cohort_id),
    CHECK (score_value IS NULL OR score_value BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS area_score_screener_idx
    ON app.area_score (release_id, score_version_id, category_key, score_value DESC);

CREATE TABLE IF NOT EXISTS app.area_score_component (
    release_id uuid NOT NULL,
    area_id uuid NOT NULL,
    score_version_id uuid NOT NULL,
    category_key text NOT NULL,
    cohort_type text NOT NULL,
    cohort_id text NOT NULL,
    metric_id text NOT NULL REFERENCES app.area_metric(metric_id),
    raw_value double precision,
    benchmark_value double precision,
    normalized_score double precision,
    configured_weight double precision NOT NULL,
    effective_weight double precision,
    missing_reason text,
    source_id text REFERENCES app.data_source(source_id),
    quality_status text,
    PRIMARY KEY (
        release_id, area_id, score_version_id, category_key, cohort_type, cohort_id, metric_id
    ),
    FOREIGN KEY (
        release_id, area_id, score_version_id, category_key, cohort_type, cohort_id
    ) REFERENCES app.area_score (
        release_id, area_id, score_version_id, category_key, cohort_type, cohort_id
    ) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app.saved_area (
    workspace_id uuid NOT NULL REFERENCES app.workspace(workspace_id) ON DELETE CASCADE,
    area_id uuid NOT NULL REFERENCES app.geographic_area(area_id),
    saved_by uuid NOT NULL REFERENCES app.app_user(user_id),
    saved_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, area_id)
);

CREATE TABLE IF NOT EXISTS app.saved_filter_set (
    saved_filter_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES app.workspace(workspace_id) ON DELETE CASCADE,
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
    query_schema_version integer NOT NULL CHECK (query_schema_version > 0),
    query jsonb NOT NULL,
    created_by uuid NOT NULL REFERENCES app.app_user(user_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_filter_set_workspace_idx
    ON app.saved_filter_set (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS app.audit_event (
    audit_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES app.workspace(workspace_id),
    actor_user_id uuid REFERENCES app.app_user(user_id),
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    request_id text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app.saved_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.saved_filter_set ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_area_workspace_isolation ON app.saved_area;
CREATE POLICY saved_area_workspace_isolation ON app.saved_area
    USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
    WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS saved_filter_set_workspace_isolation ON app.saved_filter_set;
CREATE POLICY saved_filter_set_workspace_isolation ON app.saved_filter_set
    USING (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid)
    WITH CHECK (workspace_id = nullif(current_setting('app.workspace_id', true), '')::uuid);

COMMIT;
