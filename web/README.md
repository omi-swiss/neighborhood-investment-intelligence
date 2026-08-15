# Neighborhood Investment Intelligence web

Neighborhood Investment Intelligence is organized around the investor decision sequence:
**Discover Markets → Analyze Property → Compare → Save → Monitor**. The interface keeps
methodology and provenance available while presenting the investment result before the audit detail.

Investor workflow covering Discover Markets, Analyze Property, Compare, Saved Opportunities,
underwriting, comparable analysis, and monitored watchlists. The deployed
area-data slice contains 2,072 comparable tracts across nine city-proper markets published from the
project warehouse.
The property workspace starts empty and accepts only authorized user, broker, public-record, or
licensed-feed records; it does not contain demo listings or fabricated risk data.

The public Property Universe covers every supported market. Washington, Baltimore, and
Philadelphia use verified recorded-sale snapshots; Detroit, Charlotte, Charleston, Boston, Tampa,
and Chicago use on-demand server-side searches of official city or county parcel systems. Public
records are kept distinct from active listings and do not imply that an owner is willing to sell.

## Capabilities

- Investor buy-box search covering strategy, property type, price range, return targets,
  renovation budget, financing assumptions, risk tolerance, and neighborhood preferences
- Decision-focused area results with readable labels, market quality, rental demand, risk,
  confidence, investment thesis, primary signal, primary risk, and explicit data vintage
- Constraint-specific empty-state suggestions that show the result count before a filter is changed
- Searchable, exact city-proper market selection for Washington, Baltimore, Philadelphia, Detroit,
  Charlotte, Charleston (SC), Boston, Tampa, and Chicago
- Real simplified tract boundaries synchronized with table selection, shared hover, fit, pan,
  wheel zoom, box zoom, selected and compared states
- Source-qualified neighborhood labels where official public records support them, with Census
  tract fallbacks and explicit confidence everywhere else
- Expandable, percentile-based score components and visible weights
- Area profiles with current values, 2019–2023 trends, city/metro benchmarks, sources, and quality
- Private saved areas and filter sets backed by D1
- Versioned built-in and custom opportunity strategies
- Area comparisons, spreadsheet-safe CSV exports, methodology, and data health
- Private property CSV/manual import with source permission, row validation, and lineage
- All-market public Property Universe with six live official parcel connectors, three verified
  sale snapshots, market coverage status, source vintage, and 12-record pagination
- Property filters, cards, DC-context point map, profiles, saved properties, and CSV export
- Transparent basic property favorability components with missing-data and confidence labels
- Auditable pre-tax acquisition, financing, income, expense, debt, and exit calculations
- Guided five-step Quick analysis, full Detailed analysis, decimal-safe percentage inputs, and
  source-safe listing-link and property-tax fallbacks
- Five/ten-year projections, base/conservative/optimistic/custom scenarios, and stress presets
- Private immutable model versions, property-to-model handoff, and projection CSV export
- Separate authorized sales/rental comp libraries with explicit transaction fields and lineage
- Auditable comparable matching, manual include/exclude decisions, adjustments, relative pricing,
  and confidence labels
- Six two-variable sensitivity matrices, modeled-driver ranking, and ten stress presets
- Private neighborhood/property watchlists and monitored property searches
- Pull-based, deduplicated in-app alerts with prior/current values, sources, and decision context
- Property price/status observation history captured during authorized re-imports
- Responsive layouts, keyboard-operable map features, accessible tables, and failure/empty states
- City profiles and source-controlled development, investment, and regulatory Signals workspace

## Run and validate

Use Node 22 or later and pnpm with the checked-in lockfile.

```text
pnpm install --frozen-lockfile
pnpm run dev
pnpm run build
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
```

Refresh the checked-in pilot data from the repository root:

```text
.venv/Scripts/python scripts/export_web_phase1.py
```

The exporter reads `data/warehouse/nii.duckdb` by default. Set `NII_DATABASE_PATH` or use
`--database` when the warehouse is elsewhere.

## File guide

| File or directory | Purpose | Inputs/dependencies | Output/test | Common failures |
|---|---|---|---|---|
| `app/page.tsx` | Screener route and metadata | Generated dataset, screener component | `/` | Generated data missing |
| `app/areas/[id]/page.tsx` | Area evidence/detail route | Area ID and generated dataset | `/areas/:id` | Unsupported area returns 404 |
| `app/components/OpportunityScreener.tsx` | Shared filter/table/map workflow | Typed `/api/areas` response | Interactive screener | API unavailable; filters stay intact |
| `app/components/OpportunityMap.tsx` | Boundary choropleth | Simplified real GeoJSON geometry | Accessible SVG data map | Empty filter set; invalid geometry rejected upstream |
| `app/components/AreaDetailMap.tsx` | Selected boundary | One area geometry | Detail boundary | Missing geometry |
| `app/components/SaveAreaButton.tsx` | Private save action | Authenticated API and D1 | Saved area status | No auth or DB binding |
| `app/properties/` | Marketplace and property profile routes | Private D1 property records | `/properties`, `/properties/:id` | Empty until authorized import |
| `app/components/PropertyMarketplace.tsx` | Import, filter, card, and map workflow | Property APIs and CSV parser | Interactive private marketplace | Invalid source metadata or rows |
| `app/lib/property-domain.ts` | Property validation and favorability formulas | Imported facts and linked tract | Normalized records and auditable components | Missing inputs yield explicit unavailable values |
| `app/underwriting/` | Phase 3 financial workbench | Visible assumptions and optional linked property | Scenario projections and returns | Invalid assumptions are shown, never patched silently |
| `app/lib/financial-model.ts` | Versioned underwriting calculation domain | Acquisition, debt, operations, and exit inputs | Audited metrics and yearly cash flows | Unsupported refinancing/tax cases remain explicit |
| `app/api/financial-models*` | Calculation, versioned persistence, and CSV export | Auth header and D1 for saves | Private immutable model versions | Unauthorized, invalid scenario, or missing binding |
| `app/lib/comparables.ts` | Comparable validation, matching, scaling, and confidence domain | Subject property and authorized comp records | Auditable relative-pricing analysis | No eligible records yields explicit insufficient evidence |
| `app/api/comparables*` | Comparable template, validation, and private import | Authorized sale/rental CSV records | Source-controlled comp library | Invalid transaction facts or permission metadata |
| `app/api/properties/[id]/comparables` | Subject comparable analysis and manual decisions | Private property, comp library, D1 | Saved inclusion/exclusion and adjustments | Unauthorized or missing eligible comps |
| `app/lib/sensitivity.ts` | Two-variable matrices and driver ranking | Financial assumptions and calculation v1.1 | What-if return surfaces | Invalid combinations are shown unavailable |
| `app/watchlists/` | Phase 5 monitoring workspace | Authenticated watchlists, searches, rules, and alerts | `/watchlists` | Empty until targets or searches are saved |
| `app/lib/monitoring.ts` | Snapshot and change-detection domain | Area releases and private property observations | Typed alert candidates | Regulation has no detector without a validated source |
| `app/api/monitoring*` | On-demand monitoring refresh and contract test | Auth header, D1, current evidence | Deduplicated in-app alerts | No scheduled or external delivery |
| `app/api/watchlists`, `app/api/saved-searches`, `app/api/alerts` | Phase 5 private persistence APIs | Auth header and D1 | Ownership-scoped monitoring state | Unauthorized or missing binding |
| `app/api/properties*` | Property import/search/detail/template/export APIs | Auth header, D1, source metadata | Versioned private data workflow | Unauthorized, missing binding, or validation rejection |
| `app/lib/areas.ts` | Query/scoring presentation domain | Generated JSON | Filtered and formatted records | Schema drift |
| `app/lib/types.ts` | Strict application contracts | Exporter payload | Compile-time safety | Export shape changes without types |
| `app/api/areas*` | Validated search/list API | Real pilot dataset | JSON pagination/search | Invalid query falls back to safe bounds |
| `app/api/saved-*` | Private persistence API | Auth header, D1 | Saved areas/filter sets | Unauthorized or missing binding |
| `db/schema.ts` | Durable D1 schema | Drizzle | Generated migration | Migration not generated after change |
| `db/initialize.ts` | Idempotent local/runtime table setup | D1 binding | Required tables/indexes | `DB` binding absent |
| `drizzle/` | Checked-in SQL migration | Schema definitions | Platform migration | Schema/migration drift |
| `app/data/areas.generated.json` | Reproducible real-data market artifact | DuckDB publication script | 2,072 comparable tract records | Warehouse unavailable or quality filters remove all rows |
| `tests/rendered-html.test.mjs` | Route and data contract smoke tests | Built Worker bundle | Product and API contract tests | Build not run first |
| `vite.config.ts` | Portable local and hosted binding configuration | Environment variables | Runtime wiring | D1 binding unavailable for persistence routes |
| `public/og.png` | Product-specific social preview | Approved generated asset | Link preview | Missing metadata host or asset |

## Data constraints

- Scores use ACS 2019–2023 overlapping five-year windows and are labeled accordingly.
- Rankings are within the currently supported comparable-market cohort, not national percentiles.
- Area rent/value yields are screening proxies, not property cap rates or appraisals.
- State-level crime is not assigned to tracts.
- Property favorability is a screening signal. Its NOI/cap-rate values are explicitly incomplete
  proxies and are not a substitute for the Phase 3 financial model or an appraisal.
- Financial-model outputs are pre-tax scenarios, not forecasts. Taxes, depreciation, refinancing,
  and detailed rent rolls are excluded from calculation version `nii-underwriting-v1.2.0`.
- Comparable ranges are descriptive interquartile ranges, not appraisal confidence intervals.
  Active asking prices are never silently treated as closed sales.
- Monitoring runs only when the user selects **Check for updates**. It is not a background crawler,
  and external email/SMS delivery is not configured.
- Neighborhood labels, event feeds, property records, flood, and regulation remain market-specific.
  The UI marks partial or unavailable evidence and never copies Washington context to another city.

Production pages rely on owner-only Sites access. Save APIs require the forwarded authenticated
user email; the local development identity is accepted only on `localhost`.

See `docs/investor-focused-product-redesign.md` for the product and architecture audit, phased
implementation plan, real-versus-estimated data inventory, and incomplete integrations. See
`docs/environment-and-integrations.md` for runtime bindings, credential handling, and deployment.
See `docs/property-universe.md` for market sources, live-query behavior, and record safeguards.
