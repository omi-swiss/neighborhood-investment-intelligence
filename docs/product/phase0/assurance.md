# Security, quality, and operations

## Security model

### Protected assets

- User identity, private notes, saved searches, strategies, analyses, and exports.
- Database and provider credentials, API keys, signing secrets, and source-access tokens.
- Licensed/raw property datasets and redistribution-restricted fields.
- Integrity of published observations, score versions, assumptions, and calculation results.
- Availability of the screener, spatial API, refresh pipeline, and prior verified releases.

### Trust boundaries and controls

| Boundary/threat | Control |
|---|---|
| Browser input, XSS | Schema validation, React escaping, sanitization for rich text, restrictive CSP, no unsafe HTML |
| Session theft/CSRF | OIDC PKCE, short sessions, rotation, HttpOnly/Secure/SameSite cookies, CSRF token for cookie-auth mutations |
| Broken object authorization | Workspace context in every repository operation; deny by default; cross-workspace tests |
| SQL injection | Parameterized queries; allow-listed sort/filter fields/operators; no client SQL |
| Spatial denial of service | Bounding-box/zoom/vertex/result limits, timeouts, rate limits |
| API abuse | Per-user/IP limits, payload limits, idempotency keys for imports, backoff |
| Secret disclosure | Managed secrets, startup validation, log redaction, repository/CI secret scans |
| Licensed data leakage | Field-level publication policy, private exports, audit log, signed expiring URLs |
| Supply chain | Lock files, dependency scanning, reviewed updates, minimal images, SBOM |
| Privilege escalation | Role checks on server; admin routes isolated and separately audited |
| Data tampering | Checksums, immutable source assets, release IDs, versioned formulas, publication approvals |
| Availability/data loss | PITR database backups, object versioning, restore drills, retained prior release |

TLS is required in transit. Managed volumes/backups use encryption at rest. Production administrative
access requires MFA and least privilege. Logs record who changed saved strategy/model versions and
when, but exclude secrets and sensitive free text.

### Privacy and retention

Collect the minimum account metadata. User notes and analysis exports are private by default.
Retention/deletion policy must cover accounts, audit logs, exports, imported property files, and
licensed records. Access and deletion workflows are tested before multi-user launch.

## Testing strategy

### Test pyramid

- Unit: formulas, scoring, favorability, transforms, query/filter validation, comparable rules,
  date/vintage helpers, formatting edge cases.
- Contract: OpenAPI validation, generated client compatibility, error envelope, pagination, enum
  and unit stability.
- Integration: PostGIS repositories, spatial bounds, migrations, auth, workspace isolation, saved
  areas/filter sets, publication activation, exports.
- End-to-end: search → filter → table/map → area → trends/comparisons → source explanation → save
  area/filter. Later phases extend the supplied full workflow.
- Data quality: required fields, ranges, duplicates, coordinates, source lineage, stale releases,
  metric coverage, invalid model outputs, geometry validity.
- Non-functional: accessibility automation plus manual keyboard/screen-reader checks, load tests,
  security scans, backup restoration, and map failure fallback.

Tests use deterministic small fixtures marked as test data, never styled as live production facts.
Golden analytical fixtures include provenance, vintages, missingness, margins of error, and mixed
geographic resolution. Production deployment is blocked by migration, contract, authorization,
critical accessibility, and acceptance-workflow failures.

### Phase 1 CI gates

1. Python lint/type/unit tests.
2. TypeScript lint/type/unit/component tests.
3. OpenAPI lint and generated-client drift check.
4. Clean PostGIS migration plus repeat/upgrade test.
5. API integration suite with authorization matrix.
6. Web build and dependency/secret scan.
7. Browser E2E for every Phase 1 acceptance criterion.
8. Accessibility scan and bundle/performance budgets.
9. Container image scan and staging smoke test.

## Monitoring

Use structured events and correlation IDs across web, API, jobs, and publication releases.

| Signal | Initial objective/alert |
|---|---|
| API availability | 99.5% monthly internal target; alert on sustained error ratio |
| API latency | p95 list/detail <750 ms; alert on sustained regression |
| Map latency/failures | p95 <1.5 s; table fallback always available |
| Database | connection saturation, locks, slow queries, storage, replication/backup health |
| Imports/jobs | failure, duration anomaly, zero/unexpected row count, checksum/schema change |
| Data freshness | source-specific SLA from catalogue; no global “fresh” label |
| Auth | elevated failures, token validation errors, suspicious rate patterns |
| Calculations | exceptions, null-reason spikes, version mismatch, non-finite outputs |
| Frontend | route errors, failed API calls, Web Vitals, map initialization |

The internal `/health/data` page shows service state, active release, database connectivity, each
source’s last successful ingest and expected cadence, recent failed jobs, stale metrics, and map
layer status. It shows safe summaries, not credentials or raw stack traces.

## Performance and capacity

- Server-side pagination defaults to 50 and caps at 200 rows.
- Filter and sort fields are allow-listed and indexed from observed query plans.
- API field selection limits payload size without changing metric meaning.
- Map endpoints require viewport and zoom; return simplified vector tiles or bounded features.
- Time-series endpoints return requested metrics/periods, not an entire profile.
- Background refresh failures never block reading the active verified release.
- Exports and expensive publication work are asynchronous with bounded concurrency.
- Financial calculations run in a pure domain module and update interactively; persistence is
  separate.

Profile real queries before adding indexes beyond clear keys, materialized views, or Redis.

## Backup, restore, and incident handling

- Managed PostgreSQL daily backup plus point-in-time recovery appropriate to plan tier.
- Private object storage versioning and lifecycle policies.
- Quarterly restore test to isolated infrastructure with documented recovery time/result.
- Migration and publication runbooks include preflight, forward recovery, and compatible app
  rollback.
- Incidents identify affected release/workspaces, contain access, preserve evidence, notify the
  product owner, and document corrective action.

Initial targets: recovery point ≤24 hours for user state (tighter when PITR supports it), recovery
time ≤4 hours for a small internal deployment, and zero tolerance for silent analytical corruption.

## Release checklist

- Acceptance criteria pass with realistic, labeled fixtures and a real development data release.
- No secret, raw licensed field, or private note appears in logs/client bundles.
- Source/date/resolution/quality labels render in happy and partial paths.
- Workspace authorization is tested for read and mutation endpoints.
- Query plans meet targets on representative data volume.
- Database backup is current and rollback/forward-recovery path is known.
- Methodology, limitations, release notes, and active model/data versions are published.
- Product disclaimer is visible where scores, estimates, or returns appear.
