# Data model and API contracts

## Data boundaries

The application preserves five separate record classes:

1. Source observations: immutable facts as published, with native geography and time.
2. Derived metrics: reproducible transformations of named observations and method versions.
3. System estimates: nowcasts, forecasts, comparable estimates, or defaults, visibly labeled.
4. User entries: assumptions, notes, tags, selections, overrides, and imported records.
5. Saved results: immutable score/model versions that reference exact inputs and releases.

The existing DuckDB schemas (`raw`, `standardized`, `analytics`, `quality`, `meta`) remain the
analytical build source. A validated publication job maps selected analytics outputs to the
PostGIS serving model in `phase1_schema.sql`. The web API never exposes filesystem paths, API keys,
raw source assets, or unpublished tables.

## Canonical observation contract

Every metric value exposed to the product uses this semantic envelope:

| Field | Meaning |
|---|---|
| `area_id` | Stable application area identifier |
| `metric_id` | Versioned dictionary identifier |
| `value`, `unit` | Numeric value and explicit unit |
| `observation_type` | `observed`, `nowcast`, `forecast`, `derived`, or `system_default` |
| `geographic_level` | The source value’s actual level |
| `reference_start/end` | Period represented by the value |
| `available_at` | Earliest defensible date the value was available |
| `source_vintage` | Publisher/source vintage |
| `source_id` | Source catalogue key |
| `release_id` | Serving release containing the row |
| `method_version` | Required for derived/estimated values |
| `margin_of_error` | Source MOE where applicable |
| `lower/upper_bound` | Estimate interval where applicable |
| `quality_status` | `reliable`, `caution`, `unreliable`, `not_available`, or `not_assessed` |
| `quality_messages[]` | Machine code plus user-readable reason |

An as-of query selects values whose `available_at <= as_of`. The API may return current metrics
from different reference periods and levels, but each remains labeled. It must not generate a
tract value from county QCEW or state FBI data without a separate approved derivation.

## Core entity model

### Identity and collaboration

- `users`, `user_settings`
- `workspaces`, `workspace_members` with owner/analyst/viewer roles
- `notes`, `tags`, and entity-tag links
- `audit_events`

### Geography and area evidence

- `geographic_areas`: typed/vintaged hierarchy, geometry and representative point
- `area_metrics`: metric dictionary and presentation/scoring metadata
- `area_metric_history`: source or derived observations using the canonical contract
- `area_scores`, `area_score_components`
- `score_definitions`, immutable `score_versions` and component weights
- `development_projects`, `investment_projects`
- `regulatory_policies`, `environmental_risks`
- `data_sources`, `ingestion_runs`, `data_quality_results`, `data_releases`

### Property marketplace (Phase 2)

- `properties`: durable physical/parcel identity, never listing status
- `property_characteristics`: versioned physical facts
- `property_listings`, `property_listing_history`: feed-specific marketing state
- `property_market_estimates`: source/method/versioned rent/value indications
- `property_comparables`: subject/candidate relationship, similarity, inclusion, adjustments
- `property_scores`, `property_score_components`

One physical property can have multiple listings and sources. Source records retain provider keys
and license policy. Address visibility and redistribution are governed by the source policy.

### Financial models (Phase 3)

- `financial_models`: stable workspace-owned container
- `financial_model_versions`: immutable snapshot and calculation-engine version
- `financial_scenarios`: named base/conservative/optimistic/custom cases
- `financial_assumptions`: typed values, units, resolution level, source and override status
- `financial_projection_rows`: version/scenario/year calculated rows
- `financial_results`: named auditable outputs

### Saved work and monitoring

- `saved_areas`, `saved_properties`
- `saved_searches` and versioned filter payload
- `watchlists`, `watchlist_items`
- `alerts` and delivery records

Cross-phase foreign keys point to stable containers and immutable versions. Source observations are
never updated to reflect user opinions; corrections create a new source/release version.

## API conventions

Base path is `/api/v1`. JSON uses UTF-8, ISO-8601 dates/timestamps, GeoJSON geometry, string UUIDs,
and explicit units. Auth is bearer/OIDC at the API boundary; browser sessions are exchanged
server-side.

### Query behavior

- Pagination: cursor for changing listing/event streams; `page`/`page_size` for stable screener
  release sets. Phase 1 caps `page_size` at 200.
- Sorting: repeatable `sort=field:asc|desc` values from endpoint allow-lists with a stable ID
  tiebreaker.
- Filtering: typed repeated filters or a validated POST query body for complex saved searches.
  Never accept SQL fragments.
- Field selection: `fields` only from documented projections; provenance cannot be suppressed when
  metric values are returned.
- As-of: defaults to current date, but results always include effective `as_of` and `release_id`.
- Idempotency: user-import and later job-creating mutations require `Idempotency-Key`.
- Caching: release-scoped read endpoints return ETag; authenticated mutations are not shared-cache
  eligible.

### Structured errors

```json
{
  "error": {
    "code": "INVALID_FILTER",
    "message": "The vacancy_rate filter value must be between 0 and 1.",
    "request_id": "req_...",
    "details": [{"field": "filters[2].value", "reason": "out_of_range"}]
  }
}
```

Expected status codes include 400 validation, 401 unauthenticated, 403 unauthorized, 404
not-found-within-authorized-scope, 409 version/idempotency conflict, 422 semantic input error, 429
rate limited, and 503 dependency unavailable. Stack traces and provider responses are not returned.

## Endpoint map

### Phase 1

| Method/path | Purpose |
|---|---|
| `GET /areas/search` | Typeahead supported geographies |
| `GET /areas` | Paginated/sorted/filterable screener projection |
| `POST /areas/query` | Complex validated query used by saved filter sets |
| `GET /areas/{id}` | Identity, hierarchy, geometry summary, release metadata |
| `GET /areas/{id}/metrics` | Current requested metrics with provenance |
| `GET /areas/{id}/trends` | Bounded metric history |
| `GET /areas/{id}/comparisons` | City/metro/state/national cohort ranks |
| `GET /areas/{id}/scores` | Categories and component explanations |
| `GET /map/tiles/{z}/{x}/{y}.mvt` | Viewport/zoom-aware vector tile |
| `GET /strategies` | Accessible strategy versions |
| `POST /strategies/{id}/versions` | Duplicate/edit into immutable version |
| `GET/POST /saved-areas` | Private collection |
| `DELETE /saved-areas/{areaId}` | Remove workspace save |
| `GET/POST /saved-filter-sets` | Private canonical screener queries |
| `GET /metrics` | Metric dictionary and coverage |
| `GET /sources` | Source definitions, cadence, limitations |
| `GET /health/data` | Authorized safe health/freshness summary |
| `GET /exports/areas.csv` | Bounded export of the current validated query |

### Later phases

Use distinct resources for property search/detail/listing history/estimates/comparables/scores,
financial model versions/scenarios/projections, watchlists/alerts, notes/tags, imports, and reports.
They are intentionally absent from `phase1.openapi.yaml` so no client can mistake them for working
Phase 1 functionality.

## Example area result

```json
{
  "area_id": "d8b1d93f-7e51-4c59-a4a1-32b973d61425",
  "geoid": "11001001203",
  "level": "tract",
  "name": "Census Tract 12.03",
  "context": {
    "county": "District of Columbia",
    "state": "District of Columbia",
    "state_abbr": "DC",
    "place": "Washington",
    "metro": "Washington-Arlington-Alexandria"
  },
  "score": {
    "strategy_version_id": "cbdc4d08-48f1-4f2d-9245-69147ec9e7f2",
    "value": 68.2,
    "coverage": 0.82,
    "status": "scored"
  },
  "metrics": [],
  "release_id": "7f34d2db-f1b5-48cc-becf-0d2df4e49ae2"
}
```

This object illustrates shape only. The identifiers and values are not seed data and must never be
shown as a real area result.

## Publication contract

1. The pipeline finishes an ingestion/build run with source checksums and quality results.
2. The publisher creates a `building` release and loads release-keyed staging rows.
3. Checks enforce IDs, native geography, valid periods/coordinates, metric ranges, lineage,
   expected counts, uniqueness, and referential integrity.
4. Scores are computed from the same release and immutable strategy versions.
5. A transaction marks the new release `active` and retires the prior release.
6. API responses identify the release. Failure preserves the prior active release.

## Index and partition intent

- GiST on area geometry and representative points.
- B-tree on `(release_id, area_id, metric_id, reference_end desc)`.
- B-tree on geographic type/normalized name and optional trigram index after search profiling.
- B-tree on score strategy/release/category/value for screener sorts.
- Workspace/owner indexes on every user collection.
- Partition metric history by release or reference period only after measured table size/query plans
  justify it.

The Phase 1 SQL draft is executable and intentionally narrower than the full conceptual model.
