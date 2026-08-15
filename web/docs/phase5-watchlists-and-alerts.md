# Phase 5: watchlists and alerts

Phase 5 adds private, ownership-scoped monitoring without introducing a paid data dependency.

## Supported workflow

1. Add a neighborhood or private property record to the default investment watchlist from its profile.
2. Create additional named watchlists in `/watchlists`.
3. Save current Property Marketplace filters as a monitored search.
4. Import or refresh authorized property evidence, or publish a new area-data release.
5. Select **Check for updates** to compare current evidence with the saved snapshots.
6. Review deduplicated alerts containing the prior value, current value, detection time, source, and why the change matters.

## Change rules

- Property: asking-price reduction, listing-status change, and refreshed observation.
- Area: one-point opportunity-score movement, any median-rent change, at least a
  0.5-percentage-point vacancy movement, and a new data vintage.
- Saved property search: a newly imported private property that matches the stored criteria.

The first saved snapshot establishes a baseline and does not generate historical alerts.
Alert fingerprints prevent the same observed change from being inserted repeatedly.

## Durable state

D1 stores watchlists, watched entities, saved searches, alert rules, alert inbox entries, and
property listing observations. Every query and mutation is scoped to the authenticated user email
forwarded by the private Sites deployment.

## Explicit limits

- Monitoring is user-initiated. There is no scheduled worker or background crawler in this phase.
- Alerts are delivered only inside the application. Email and SMS require a separately approved
  provider and credentials.
- Regulation-change rules are displayed as source unavailable and are not evaluated until a
  validated primary policy source is connected.
- The system compares authorized private imports and checked-in public area publications. It does
  not scrape restricted listing services.
