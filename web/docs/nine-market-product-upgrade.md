# Nine-market product upgrade

The existing Vinext/React, D1, DuckDB, and Sites architecture is preserved.

## Delivered

- 2,072 ACS 2023 tracts comparable to ACS 2019 across Washington, Baltimore,
  Philadelphia, Detroit, Charlotte, Charleston (SC), Boston, Tampa, and Chicago.
- Stable Census-place market IDs with city-proper and metro definitions kept separate.
- County, city, state, tract label, optional neighborhood, naming source, confidence,
  and observation count in the shared area contract.
- Exact market filtering, synchronized map/table hover and selection, fit/reset/pan/wheel
  zoom/box zoom, double-click detail, and distinct comparison state.
- Guided five-step Quick underwriting and the existing full Detailed workflow.
- Decimal-safe percentage normalization, listing-link validation without scraping, and
  property-tax automation only when an authorized property record contains the fact.
- A city-level Signals workspace with demographic/housing profiles, filterable evidence,
  source links, and explicit partial-coverage states.

## Coverage guardrails

Official neighborhood names are partial: Baltimore and Philadelphia receive names when
public property-record aggregation supports them; other areas retain their Census tract
fallback. Development, environmental, flood, regulatory, property, and investment-event
coverage remains market-specific. Washington evidence is never copied into another city.
Announcements, award leads, and permits do not imply completed investment.

## Performance

The expanded dataset exposed an existing client dependency that bundled all tract geometry
into the Property Marketplace. The production build showed a 3.89 MB minified route chunk.
Property-type constants were separated from server-side tract enrichment and boundaries now
load from the area API on demand. The route-specific Property Marketplace bundle is now about
13 KB and the production build emits no large-chunk warning.

Map path projection is memoized by bounds/data and stale area requests are aborted.

## Validation

- TypeScript check: passed.
- Production Vinext build: passed.
- Product and API contract suite: 21 passed.

The warehouse migration is additive. Scores remain screening ranks, gross yield remains an
area proxy, financial outputs remain pre-tax scenarios, and no output is an appraisal, legal
opinion, or investment recommendation.
