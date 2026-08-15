# Phase 8: product services and data population

Phase 8 turns the governed layers into decision-support services before scaling data collection.

## Product-service order

1. **Evidence service** — one response contract for observed, estimated, projected, unavailable, and source-stale values.
2. **Map service** — tract/county shapes plus public/private project pins and source-native risk layers.
3. **Comparison service** — side-by-side counties, tracts, and saved neighborhoods without mixing incompatible geography or time.
4. **Strategy profiles** — user-controlled weights and hard constraints for cash flow, appreciation, stability, development momentum, and risk tolerance.
5. **Alerts service** — material source changes, project stage changes, stale evidence, and saved-search threshold crossings.
6. **Exports/API** — CSV/GeoJSON first, then stable paginated HTTP endpoints using the same response contracts.

Relative-value products must show component values, observation status, source date, geography, and confidence. Scores are versioned views, not facts.

## Population sequence

The efficient sequence is:

1. establish a national baseline from bulk public releases;
2. automate high-value federal/state sources;
3. add local capital budgets, planning, permitting, tax, and regulation evidence for prioritized markets;
4. run discovery feeds for private projects;
5. verify discoveries against permits, financing/property records, SEC filings, procurement/award records, or official disclosures;
6. publish coverage and staleness metrics alongside the data.

Initial source families include federal demographic/employment/housing data already present; public capital awards and capital plans; official transit schedules and capital projects; local planning and permitting; SEC EDGAR and official company disclosures; FEMA flood/climate products; EPA contamination/brownfield/Superfund products; and official state/local statutes, codes, tax authorities, and insurance regulators.

Most baseline bulk downloads and reviewed-file imports do not require API keys. Potential keys should be requested only when an adapter is scheduled:

- WMATA developer access for WMATA-specific service data, once approved;
- SAM.gov API access if federal contracting detail materially improves the public-project feed;
- state/local planning or permitting portal credentials where a jurisdiction requires them.

SEC EDGAR does not use an API key but requires a compliant identifying user agent and request-rate discipline. Paid real-estate feeds remain optional and are not required for the baseline product.

## Definition of healthy population

Every product surface reports:

- covered versus uncovered geography;
- latest observation/source date;
- successful and failed ingestion runs;
- verified, needs-review, and stale counts;
- native geography and assignment method;
- observed, estimated, projected, and unavailable status;
- source and methodology links.

An empty but honest product is preferable to an apparently complete product built from unsupported geographic assignment or unverified announcements.
