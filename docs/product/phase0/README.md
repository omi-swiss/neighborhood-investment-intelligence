# Phase 0 product and architecture package

Status: proposed for approval
Scope boundary: product design only; no Phase 1 runtime is represented as complete
Product name: Neighborhood Investment Intelligence (NII)

## Decision summary

Build a desktop-first, responsive decision-support application with a Next.js/TypeScript
frontend, a Python/FastAPI analytical API, and PostgreSQL/PostGIS as the serving database.
Keep the existing Python/DuckDB pipeline as the reproducible ingestion and analytical build
layer. Publish versioned, curated outputs to PostGIS; never query raw source files from a web
request.

The first shippable slice is the Opportunity Screener. Property listings, underwriting,
comparables, and alerts remain designed but out of runtime scope until their phases. This
prevents an attractive shell from implying that unlicensed or unavailable property data exists.

## Deliverable index

| Requested deliverable | Canonical file |
|---|---|
| 1. Recommended technology stack | `architecture.md` |
| 2. Alternatives considered | `architecture.md` |
| 3. Product requirements document | `product.md` |
| 4. User personas | `product.md` |
| 5. Primary user journey | `product.md` |
| 6. Information architecture | `product.md` |
| 7. Page map | `product.md` |
| 8. Low-fidelity wireframes | `experience.md` |
| 9. Component hierarchy | `experience.md` |
| 10. Database schema | `data-api.md`, `phase1_schema.sql` |
| 11. API contract | `data-api.md`, `phase1.openapi.yaml` |
| 12. Financial-model specification | `models.md` |
| 13. Property-favorability methodology | `models.md` |
| 14. Area scoring methodology | `models.md` |
| 15. Security model | `assurance.md` |
| 16. Testing strategy | `assurance.md` |
| 17. Deployment approach | `architecture.md` |
| 18. Operating-cost estimate | `architecture.md` |
| 19. Phased roadmap | `product.md` |
| 20. Major risks and unresolved decisions | `product.md` |

## Phase 0 definition of done

- All twenty requested artifacts are indexed above and internally consistent.
- The recommended architecture has an explicit decision record and rejects unnecessary
  infrastructure.
- Existing source geography, vintage, availability, quality, and estimate distinctions survive
  the application boundary.
- Phase 1 has a machine-readable API contract and an executable PostgreSQL/PostGIS schema draft.
- Financial and scoring methods are formula-level specifications, not unexplained labels.
- Security, testing, monitoring, performance, deployment, and cost targets are defined.
- Later-phase concepts are modeled without claiming they are implemented or populated.

## Phase 1 release gate

Phase 1 may begin after approval of these defaults:

1. The initial audience is a small private workspace, not public self-service sign-up.
2. Census tracts are the primary neighborhood unit; counties, places, ZIP contexts, and metros
   are filters or comparison cohorts only when the source supports them.
3. The application labels observations, nowcasts, forecasts, and geographic resolutions
   separately.
4. The default score is a transparent ranking aid, never an investment recommendation.
5. Map layers use viewport-limited vector or GeoJSON responses and never ship the national tract
   file to the browser.

## Generated-file operating notes

| File | Purpose | Dependencies | Inputs | Outputs | Run/test | Common failures |
|---|---|---|---|---|---|---|
| `README.md` | Manifest and phase gate | Other Phase 0 files | Product prompt, repository audit | Traceable deliverable index | Review links and checklist | A deliverable exists but is not indexed |
| `product.md` | PRD, users, journeys, IA, roadmap, risks | Existing data catalogue | Product goals and data availability | Agreed scope and sequencing | Review acceptance tables | Scope leaks across phases |
| `architecture.md` | Stack decision and operations topology | Existing Python ETL | Scale, cost, spatial, auth needs | Architecture decision | Review decision matrix and diagrams | A service is added without a requirement |
| `experience.md` | Page behavior, wireframes, components | PRD and API vocabulary | Primary journeys | Implementable UX blueprint | Review at desktop/mobile widths | Map and table state diverge |
| `data-api.md` | Entity boundaries, contracts, API semantics | Existing warehouse schema | Curated analytics and user actions | Serving contracts | Validate against SQL/OpenAPI | Geography or vintage silently changes |
| `phase1_schema.sql` | Executable Phase 1 serving schema draft | PostgreSQL 16, PostGIS | Curated publication jobs | Relational and spatial tables | Apply in an empty test database twice | PostGIS missing; unsupported database version |
| `phase1.openapi.yaml` | Machine-readable Phase 1 HTTP contract | OpenAPI 3.1 tooling | API design | Generated clients and contract tests | Lint and validate in CI | Schema drift from implementation |
| `models.md` | Financial, favorability, and area-score definitions | Metric definitions and assumptions | Observations, estimates, user overrides | Reproducible versioned calculations | Formula unit tests in later phases | Hidden defaults or ambiguous units |
| `assurance.md` | Security, testing, performance, monitoring | Architecture and contracts | Threats and service objectives | Release controls | CI/security review and runbooks | Authorization checked only in UI |

The SQL and OpenAPI files are Phase 0 design artifacts. Applying the schema does not by itself
make Phase 1 functional.
