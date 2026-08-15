# Nine-market product upgrade

## Architecture audit

The upgrade preserves the existing Vinext/React application, D1 user workspace, DuckDB analytical
warehouse, and generated-data publication path. The map remains a lightweight accessible SVG
instead of introducing a second mapping runtime. Underwriting formulas remain isolated in
`app/lib/financial-model.ts`; the interface now exposes them through guided and detailed modes.

## Shared geography and naming contract

- Stable market IDs use Census place identifiers, for example `place:1150000`.
- City-proper and metro definitions are separate records. Nine city-proper tract cohorts are live;
  metro cohorts are visible as planned and are not selectable.
- An area always retains Census tract GEOID and tract label.
- A neighborhood name is shown only when a source-controlled public-record aggregation supports it.
  Baltimore and Philadelphia currently have partial neighborhood labels. Other areas fall back to
  the tract label with low confidence.
- County, city, state, market, naming source, confidence, and observation count travel together.

## Coverage

The ACS 2023 scoring slice contains 2,072 tracts comparable to ACS 2019 across Washington,
Baltimore, Philadelphia, Detroit, Charlotte, Charleston (South Carolina), Boston, Tampa, and
Chicago. This is smaller than the raw 2023 city-tract count because cross-vintage tract changes are
excluded rather than joined incorrectly.

Property records and Signals evidence are not equally complete:

- Public sale/neighborhood context: Washington, Baltimore, and Philadelphia, with tract assignment
  limitations noted in the source data.
- Development permits, environmental points, flood context, and regulatory summaries: Washington
  pilot unless a source says otherwise.
- Investment awards: discovery candidates until project identity and coordinates are reviewed.
- Active listings: user-supplied or authorized-feed records only.

## Opportunity Screener changes

- Exact market filtering and searchable city labels.
- Fit-results, reset, wheel zoom, drag pan, and box zoom.
- Memoized SVG path calculations.
- One selected area and one hovered area shared by map and table.
- Stable row IDs allow a map selection to page and scroll the matching table record into view.
- Double click opens the area profile; compare selections have a distinct outline.

## Underwriting changes

- Quick analysis is a five-step workflow: Property, Financing, Income, Expenses, Review.
- Detailed analysis retains all existing acquisition, debt, expense, exit, scenario, sensitivity,
  stress, export, and versioning controls.
- Percentage inputs normalize decimal representation before model calculation and serialization.
- Listing URLs are validated as evidence links. Protected listing pages are not scraped.
- Property tax automation uses an observed authorized property record only. If no parcel-linked
  tax fact exists, the interface asks for a manual value instead of applying a generic city rate.

## Signals changes

- Every supported city has an ACS profile with population, households, age, income, housing,
  rental, economic-risk, and data-quality context.
- Education and migration are marked unavailable because they are not loaded into the current
  tract profile.
- Investment/development events are filterable and link to their source evidence.
- A market with no verified events or policy profile receives a specific partial-coverage state.
- Save-city and save-signal actions are currently session workspace actions; durable multi-entity
  watchlist support remains a follow-on D1 enhancement.

## Performance notes

Before this upgrade, geometry was projected repeatedly during every map render and requests could
complete after a newer query. Now projected paths are memoized by bounds/data and stale area
requests are aborted. Market selection also limits the normal map view to one city cohort instead
of drawing every market by default. No second mapping library or client-side warehouse payload was
added.

Expanding the generated dataset initially exposed an existing client-bundle coupling: the Property
Marketplace imported the full tract dataset through its property domain. The production build
showed a 3.89 MB minified route chunk. Property type constants were separated from server-side
tract enrichment and boundary context now loads from the area API on demand. After the change, the
largest route-specific Property Marketplace chunk is approximately 13 KB and the build no longer
emits the 500 KB chunk warning.

## Migrations and rollback

`migrations/duckdb/017_market_intelligence_foundations.sql` adds shared market, naming, signal,
and tax-evidence contracts. It is additive. Rollback can stop reading these tables without dropping
existing observations; destructive table removal is intentionally not automated.

## Source and interpretation guardrails

- U.S. Census Bureau ACS 5-year: tract profiles and trends.
- TIGER/Line-derived warehouse geography: tract boundaries and place/metro assignments.
- Local public property records: partial neighborhood naming and sale context.
- DC building permits, EPA, FEMA, official District policy, and USAspending candidates: current
  Washington evidence layers.

Scores are screening ranks, gross yield is a median-rent/value proxy, announcements are not
completed projects, permits are not proof of construction, and no output is an appraisal, legal
opinion, or investment recommendation.
