# Investor-focused product redesign

## Application audit

The application is a Next-compatible React 19 application built with Vinext for Cloudflare Workers. Durable user state is stored in Cloudflare D1 through Drizzle. Market evidence is published as typed, generated JSON; private properties, comparable records, saved areas, financial models, scenarios, watchlists, searches, and alerts use D1.

The current architecture already centralizes the important calculation domains:

- `app/lib/areas.ts` and `app/lib/area-shared.ts`: tract filtering, strategy weights, scoring, and formatting.
- `app/lib/property-domain.ts`: property validation and property-level screening signals.
- `app/lib/financial-model.ts`: acquisition, financing, operating, exit, IRR, NPV, DSCR, equity multiple, and break-even calculations.
- `app/lib/comparables.ts`: authorized sale and rental comparable validation and matching.
- `app/lib/sensitivity.ts`: stress tests, two-variable matrices, and driver ranking.
- `app/lib/monitoring.ts`: snapshot comparison and alert candidates.
- `app/components/OpportunityMap.tsx`: simplified tract geometry, synchronized selection, pan, zoom, evidence layers, and accessible keyboard interaction.

## Current strengths

- Real tract geometry and real published market observations; fabricated listings are prohibited.
- Exact city identifiers and explicit city-versus-metro semantics.
- Versioned scoring strategies with visible component weights.
- Authorized property import, validation, provenance, and immutable financial-model versions.
- Centralized financial formulas with validation and safe division.
- Base, conservative, optimistic, custom, and stress scenarios.
- Comparable matching with manual inclusion, exclusion, and adjustments.
- D1-backed saved work, watchlists, and pull-based monitoring.
- Central source registry and per-layer data-vintage disclosure.

## Product and technical weaknesses found

- The first page began with research filters rather than an investor buy box.
- Navigation exposed internal product modules instead of the investor decision sequence.
- Fallback area labels were often generic city labels or tract-first names.
- The screener emphasized a composite score but did not summarize the investment thesis, weakest factor, market-quality score, rental-demand score, or risk level in the result row.
- Property return requirements had no place in the discovery step, which made the handoff into property analysis feel disconnected.
- Empty results explained that nothing matched but did not identify the binding filters or calculate nearby relaxations.
- The area detail page placed raw evidence before a concise investor decision summary.
- ZIP crosswalks, national percentiles, tract-level crime, and several local risk datasets are not yet available. These must remain visibly missing rather than inferred.
- Detailed multifamily rent rolls, reverse underwriting, and a formal Deal Brief are not yet represented as separate durable domain objects.

## Phase 1 architecture changes

Phase 1 preserves all existing APIs and calculation logic. It adds `app/lib/area-insights.ts` as a presentation-domain layer. That module derives readable fallback labels, market-quality and rental-demand summaries, risk labels, confidence labels, contributors, and plain-language theses from existing scored observations. It does not introduce new market facts.

The primary navigation now follows the investor workflow:

1. Discover Markets
2. Analyze Property
3. Compare
4. Saved Opportunities
5. Methodology

Underwriting, Signals, Watchlists, Sources, Data Health, and Advanced Strategy remain available under Systems.

The Discover page now stores a device-local investor search profile containing strategy, property type, price range, return targets, renovation limit, financing, risk tolerance, and neighborhood preference. Only market-supported constraints affect area ranking. Deal-return targets are carried forward to property analysis and are not misrepresented as tract returns.

## Updated page structure

- `/`: investor search, advanced market filters, synchronized map and opportunity table, score explanation.
- `/areas/:id`: investor decision snapshot followed by area evidence and trends.
- `/properties`: property discovery, manual and authorized import, off-market research, property-to-underwriting handoff.
- `/underwriting`: quick and detailed financial analysis, scenarios, stress tests, and sensitivity.
- `/compare`: side-by-side opportunity comparison.
- `/saved`: saved areas, properties, and strategy/filter state.
- `/methodology`: scoring and calculation methodology.
- `/sources`: centralized sources, freshness, public-record systems, and policy references.

## Data-model changes

Phase 1 requires no D1 migration. The investor buy box is a device-local preference because it is not yet a saved opportunity or a monitored rule. Phase 2 should add durable models for:

- property intake drafts and per-field provenance status;
- rental estimate versions and comparable selections;
- tax and insurance estimate versions;
- Deal Brief versions and recommendation rationale;
- property risk observations and due-diligence tasks.

Phase 3 should add:

- rent-roll units and lease facts;
- additional-income lines;
- operating-expense lines;
- reverse-underwriting constraints and maximum-offer results;
- renovation phases and stabilized-operation assumptions.

Phase 4 should add opportunity workflow status, notes, comparisons, offer assumptions, and monitoring subscriptions.

## Implementation sequence

1. Phase 1: investor navigation, buy box, readable labels, decision-focused screener, score explanations, responsive layout, map-table synchronization, and actionable empty states.
2. Phase 2: property intake review, field-level provenance, rent/tax/insurance estimates, separate deal score, and Deal Brief.
3. Phase 3: rent roll, detailed expenses, reverse underwriting, maximum offer, scenarios, standardized risk panel, and due diligence.
4. Phase 4: property comparison, saved opportunity workflow, statuses, notes, and monitorable offer assumptions.

## Real data, estimates, and unavailable evidence

Real data currently includes published ACS tract metrics and trends, Census geometry, supported public property-sale records, curated primary-source investment events, market context sources, authorized user imports, and user-entered underwriting assumptions.

Derived values include percentile scores, gross-yield proxy, readable directional fallback labels, market-quality and rental-demand summaries, risk labels based on economic-resilience components, and financial-model outputs. These are labeled as rankings, proxies, or scenarios rather than observed property facts.

Unavailable or incomplete items include national tract percentiles, comprehensive ZIP crosswalks, tract-level crime, universal transit proximity, complete local permits outside connected markets, parcel-level tax automation for every jurisdiction, insurer quotes, listing-platform extraction, and background notifications.

## External integrations still required

- A compliant property/listing data provider or user-authorized ingestion method.
- Jurisdiction-specific parcel, assessment, transfer-tax, and reassessment connectors.
- Rental comparable feeds with licensed use rights.
- Flood, wind, wildfire, heat, and insurance-market data suitable for property-level use.
- Geocoding, ZIP crosswalk, neighborhood boundary, landmark, and transit feeds.
- A scheduled-job and notification provider before monitoring can be described as automatic.

No unavailable integration is represented as active, and no source-specific value is copied into an unsupported market.
