# Product requirements

## Product thesis

Neighborhood Investment Intelligence converts traceable public, licensed, and user-supplied data
into a disciplined funnel:

`screen areas → inspect evidence → review properties → underwrite → compare → monitor`

It supports research and decision-making. It is not an appraisal, investment recommendation,
lending decision, or substitute for legal, tax, insurance, environmental, or physical due
diligence.

## Outcomes and non-goals

### Outcomes

- Reduce the time required to narrow a large U.S. geography set to a defensible shortlist.
- Make every score explainable through metrics, direction, weight, date, geography, source, and
  quality.
- Preserve a chain from published observation to derived metric to score to saved decision.
- Let an analyst move from area evidence to property and underwriting workflows without
  re-entering context.
- Reproduce saved analyses after source data, strategy weights, or assumptions change.

### Non-goals for the initial releases

- Automated acquisition decisions or promises of return.
- A public listing portal, brokerage service, formal appraisal, or unrestricted MLS mirror.
- Scraping restricted listing websites.
- Artificially filling missing observations or relabeling county values as tract values.
- Real-time national parcel coverage in Phase 1.
- A single opaque “best neighborhood” score.

## Personas

| Persona | Goal | Typical decision | Critical needs | Failure to avoid |
|---|---|---|---|---|
| Principal investor | Allocate research time and capital | Which markets enter diligence? | Fast ranking, risk decomposition, reproducible assumptions | False certainty from one composite score |
| Acquisition analyst | Build a defensible shortlist | Which areas/properties merit a call? | Dense filters, map/table sync, comparison, exports | Manual spreadsheet reconciliation |
| Underwriting analyst | Test property economics | What price and financing work? | Auditable formulas, scenarios, sensitivity, version history | Silent defaults or formula drift |
| Research/data steward | Defend inputs and refreshes | Can this metric be trusted now? | Source lineage, vintages, geographic resolution, health | Stale or misallocated data |
| Read-only reviewer (future) | Review a recommendation | Why did the team select this asset? | Stable links, notes, assumptions, provenance | Seeing private workspace data without authorization |

## Primary journey

1. The analyst searches for a city or metro and selects a supported geographic context.
2. The Opportunity Screener loads tracts in the visible/filter scope using server pagination.
3. The analyst applies multiple metric filters or a versioned strategy preset.
4. Table and map update from one canonical query state.
5. The analyst expands a score to inspect components, quality warnings, sources, dates, and
   missing-data effects.
6. The analyst opens an area profile and compares current values and trends with city and metro
   cohorts.
7. The analyst saves the area and filter set to the private workspace.
8. In Phase 2, the analyst opens legitimately sourced properties within that area.
9. In Phase 3, a selected property opens a versioned financial model.
10. Later, comparisons and watchlists preserve the decision history and signal changes.

## Functional requirements

### Cross-product

- Authenticated private workspaces; authorization enforced at every user-owned resource.
- Global area/property search, unit-aware filters, saved objects, notes, exports, and data
  definitions.
- Visible `as_of`, reference period, publication date, source, resolution, observation type,
  calculation version, and quality state where applicable.
- Explicit loading, empty, partial, stale, authorization, validation, and service-error states.
- Keyboard-operable controls, visible focus, accessible contrast, semantic tables, and text
  alternatives for chart/map insights.

### Phase 1 — Opportunity Screener

- Search supported cities, metros, counties, ZIP contexts, and tracts.
- Combine filters across demographics, income, employment, housing, rent, price, safety,
  development, investment, risk, and data quality—only when real metrics exist.
- Select, duplicate, and edit versioned strategy presets.
- View, sort, paginate, and export a table; view the same query on a map.
- Open an area profile with summary, current metrics, five-vintage trends, city/metro comparison,
  nearby areas, methodology, provenance, and warnings.
- Save areas and filter sets.

If a requested metric is unavailable—such as tract flood risk before a source is integrated—the
filter is disabled with a reason. It is never populated with demo values in production.

### Phase 2 — Property Marketplace

Accept licensed feeds, broker feeds, public records, CSV uploads, approved APIs, and manual entry.
Preserve source and redistribution rights. Support search/list/map/card views, property details,
market estimates, initial comparables, saved properties, and basic transparent favorability. The
data model supports all requested property types; initial UI scope is single-family, condo, and
two-to-four-unit unless a valid feed justifies more.

### Phase 3 — Financial Model

Provide quick and detailed acquisition, financing, unit-income, expense, projection, scenario,
sensitivity, and stress workflows. All outputs resolve through the assumption hierarchy and a
versioned calculation engine specified in `models.md`.

### Later phases

- Phase 4: manually reviewable comparables, confidence ranges, advanced favorability,
  sensitivities, and stress tests.
- Phase 5: watchlists and source-backed change alerts.
- Phase 6: reports, exports, shared workspaces, roles, annotations, and review workflow.

## Information architecture

Persistent application navigation:

- Opportunity
  - Screener
  - Saved filter sets
  - Area comparison
- Properties
  - Marketplace
  - Imports
  - Property comparison
- Underwriting
  - Models
  - Scenarios
- Watchlists
- Data & Methodology
  - Metric dictionary
  - Source catalogue
  - Score versions
  - Data health
- Settings
  - Profile and workspace
  - Strategies
  - Defaults
  - Alerts

Contextual handoffs preserve `area_id`, `strategy_version_id`, `as_of`, and selected property or
model identifiers. Browser URLs encode shareable non-secret view state; private resources still
require authorization.

## Page map

| Route | Phase | Purpose |
|---|---:|---|
| `/opportunity` | 1 | Search, filters, synchronized table/map |
| `/opportunity/areas/[areaId]` | 1 | Area evidence, trends, comparisons, sources |
| `/opportunity/compare` | 1 | Side-by-side areas |
| `/saved/areas` | 1 | Private saved-area collection |
| `/saved/filters` | 1 | Private versioned filter sets |
| `/properties` | 2 | Property marketplace |
| `/properties/import` | 2 | Licensed/user data intake |
| `/properties/[propertyId]` | 2 | Property detail and context |
| `/properties/compare` | 4 | Property comparison |
| `/underwriting` | 3 | Saved financial models |
| `/underwriting/[modelId]` | 3 | Assumptions, projections, scenarios |
| `/watchlists` | 5 | Monitored areas/properties/searches |
| `/methodology/metrics` | 1 | Metric definitions and formulas |
| `/methodology/sources` | 1 | Sources, freshness, limitations |
| `/methodology/scores` | 1 | Score composition and versions |
| `/health/data` | 1 | Internal source/job/data freshness |
| `/settings/strategies` | 1 | Duplicate/edit strategy versions |
| `/settings/workspace` | 6 | Members and roles |

Future routes must return a clear “not enabled” state until their backing capability exists; they
must not display synthetic content.

## Phase 1 acceptance matrix

| Criterion | Verification |
|---|---|
| Search for an urban area | Search API contract test plus browser E2E |
| Multi-metric filters | Repository integration tests plus E2E |
| Table and map | Shared query-state E2E; viewport request assertion |
| Sort and paginate | API boundary tests and table E2E |
| Area detail | Route E2E |
| Values and trends | Fixture-based query and chart tests |
| City/metro comparisons | Cohort query tests; resolution labels |
| Explainable scores | Component totals and missingness tests |
| Sources and dates | Contract tests require provenance object |
| Quality warnings | Known-warning fixture displayed |
| Save area and filter set | Authorization/persistence integration tests |
| Automated tests | CI blocks merge on required suites |
| Deployable | Container build, migrations, smoke test, rollback instructions |

Performance targets at initial internal-tool load: p95 JSON list/detail response under 750 ms for
normal cached database state; initial application shell under 2.5 s on a typical broadband desktop;
filter interaction feedback under 100 ms; viewport map response under 1.5 s; financial recalculation
under 100 ms once implemented. Measure before adding Redis.

## Roadmap and gates

| Phase | Deliverable | Exit gate |
|---:|---|---|
| 0 | This product/architecture package | Decisions approved; contracts lint; SQL parses in test Postgres |
| 1 | Opportunity Screener | All 15 supplied acceptance criteria pass; deployed and documented |
| 2 | Property Marketplace | Legal source approved; import/search/detail/save tests pass |
| 3 | Financial Model | Formula golden tests, version replay, scenarios, projections pass |
| 4 | Comparables and advanced signals | Manual comp control, confidence, sensitivity and stress tests pass |
| 5 | Watchlists and alerts | Idempotent change detection, delivery preferences, audit trail pass |
| 6 | Reporting and collaboration | PDF/CSV, roles, shared workspace, access tests pass |

## Major risks and unresolved decisions

| Risk/decision | Current position | Required resolution |
|---|---|---|
| Property listing rights | No feed assumed; restricted scraping prohibited | Approve a licensed feed or user-import policy before Phase 2 |
| Geographic mismatch | Preserve source-native level and vintage | Approve crosswalk method before cross-vintage tract comparisons |
| False precision | Expose MOE, method, bounds, quality, and estimate labels | Establish minimum quality thresholds with users |
| Private investment completeness | Current registry can hold announcements; coverage is incomplete | Define monitored sources, verification SLA, deduplication owner |
| Environmental/flood data | Not yet integrated | Choose public source, licensing, vintage, and spatial allocation |
| Crime granularity | Existing state-month data cannot become tract crime | Select jurisdiction sources for priority markets |
| Auth provider | Managed OIDC recommended; provider undecided | Choose provider before production accounts |
| Hosting | Frontend on Sites; API/database vendor not yet locked | Benchmark latency/cost and select before production deployment |
| National map cost | Vector tiles and viewport limits specified | Load-test representative national/city use |
| Strategy defaults | Methods specified; investment policy is user-specific | Approve initial weights/exclusions with a domain owner |
| Current-data blending | Mixed vintages are necessary | UI must keep reference date, available date, and resolution visible |
| Regulatory data | Coverage and interpretation vary | Define authoritative sources and review responsibility |
| Liability | Decision support only | Counsel reviews terms, licensing, privacy, and disclaimers |
| Multi-tenancy | Schema is workspace-ready; Phase 1 may use one workspace | Decide invite/role model before shared workspaces |

## Product sign-off questions

Phase 1 can use the recommended defaults without blocking, but the product owner should confirm:
initial target markets, first strategy preset weights, managed identity provider, and preferred
API/PostGIS hosting vendor. Property feed and environmental risk choices are not Phase 1 blockers
because unavailable filters will be explicitly disabled.
