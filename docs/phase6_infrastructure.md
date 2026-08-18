# Phase 6: investment and infrastructure

Phase 6 separates physical condition, public capital, and private development evidence. It does not turn a press announcement into funded investment.

## Layers

- `standardized.fhwa_nbi_county_observation`: official FHWA bridge condition at county resolution.
- `standardized.public_investment_project`: transit, roads, parks, schools, utilities, flood mitigation, housing rehabilitation, and other public capital projects.
- `standardized.private_investment_project`: employer expansions, offices, data centers, industrial, residential, commercial, institutional, adaptive-reuse, and similar private projects.
- `analytics.public_investment_map_pin` and `analytics.private_investment_map_pin`: verified point records only.
- `analytics.county_investment_summary`: announced and committed values reported separately.

Public projects retain proposed, budgeted, appropriated, awarded, and spent dollars in separate columns. Private projects retain evidence type, funding status, total announced capital, and committed capital. News-only private records can be retained as `NEEDS_REVIEW` but cannot be published as verified evidence.

## Import and publication

Use the reviewed templates:

- `templates/public_investment_projects.csv`
- `templates/private_investment_projects_v2.csv`

Then run:

```text
uv run nii register-sources
uv run nii ingest-public-projects --file <reviewed-public-projects.csv>
uv run nii ingest-private-projects --file <reviewed-private-projects.csv>
uv run nii build-phase67
uv run nii export-phase67
```

Each import receives an ingestion run, checksum, and immutable raw asset record. Empty registries are valid and publish empty extracts rather than fabricated coverage.

No API key is required for these reviewed CSV imports. Later automated adapters should favor capital budgets, procurement/award records, permits, planning records, financing/property records, SEC filings, and official company disclosures. Press coverage is discovery evidence, not final verification.

The FHWA layer remains county-level and is not down-assigned to tracts. Transit accessibility remains separate from bridge condition and should use official schedule/service and capital-project evidence when available.

## NYC urbanism connector

`nii ingest-nyc-development --start-date YYYY-MM-DD --limit 250` loads the newest bounded set from three NYC Department of Buildings Open Data feeds: legacy job filings, DOB NOW filings, and issued permits. Each feed retains its source URL, retrieval asset, configured observation window, BBL when supplied, and native status. Filings remain **application evidence**; issued permits remain **authorized-work evidence**. Neither is a construction start, completion, project cost, or financing commitment.

The Phase 8 export assigns NYC records to `place:3651000`, so they are returned only for New York City. Land-use applications and public-capital projects require separate adapters because their lifecycle and financial semantics differ from DOB records; they must not be merged into the permit stream.
