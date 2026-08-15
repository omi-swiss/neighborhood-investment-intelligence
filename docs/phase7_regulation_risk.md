# Phase 7: regulation and risk

Phase 7 is an evidence registry, not legal advice and not a hidden risk score.

## Regulation

`standardized.regulatory_policy` is time-versioned by state, county, or city. Every record keeps an official source URL, last verification date, review status, confidence, effective date, and optional expiration date.

The analytical product reports active verified policy counts by separate dimension:

- tenant protections
- eviction complexity
- rent-growth restrictions
- landlord compliance
- property tax
- development restrictions
- short-term-rental restrictions

These dimensions are never collapsed into a universal “landlord friendly” score. Use `templates/regulatory_policies.csv` and:

```text
uv run nii ingest-regulatory-policies --file <reviewed-policies.csv>
```

## Environmental, physical, and insurance risk

`standardized.environmental_risk_observation` preserves the source-native geography, vintage, assignment method, metric, value, unit, and provenance. Supported categories include flood, historical flood, wildfire, heat, sea-level rise, contamination, brownfields, air quality, noise, industrial proximity, Superfund, climate, and insurance.

Only reviewed observations enter `analytics.geography_risk_profile`, and the output exposes individual factors instead of a composite score. Use `templates/environmental_risk_observations.csv` and:

```text
uv run nii ingest-environmental-risk --file <reviewed-risk-observations.csv>
uv run nii build-phase67
uv run nii export-phase67
```

No API key is required for the import-ready Phase 7 pipeline. Automated collection will be added source by source during Phase 8 population work. A metric must not be assigned to a smaller geography unless its source or a documented allocation method supports that resolution.
