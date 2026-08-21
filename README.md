# Neighborhood Investment Intelligence

Phase 0 and Phase 1 foundation for reproducible U.S. census-tract fundamentals. This repository intentionally does **not** rank tracts with a universal "best" score. It creates traceable observations, quality flags, and a tract-year profile that later strategy models can consume.

## What is implemented

* 2019-2024 ACS 5-year tract ingestion (configurable; six vintages by default)
* Raw, checksum-addressed response preservation and ingestion lineage
* Long-form estimates and MOEs, derived tract-year profile, inflation adjustment, and trends
* Census tract, place, and CBSA reference geography from TIGER/Line, with lineage-preserving tract context assignments
* Explicit profile completeness and ACS-MOE reliability findings, duplicate prevention, source metadata, and a Parquet export
* Phase 2 LODES bulk-download and tract aggregation for resident workers, workplace jobs, and commuting flows
* BLS QCEW county-level employment, establishment, and wage indicators, explicitly retained at county resolution
* A local, read-only as-of dashboard that distinguishes observed data from future nowcasts/forecasts
* Local DuckDB execution plus PostGIS production migration

## Web application

The Tableau/Power BI exports and local diagnostic dashboard are no longer the planned primary
product surface. The production web-product requirements and architecture are indexed in
[Phase 0 product and architecture](docs/product/phase0/README.md). The first deployable Opportunity
Screener slice and its remaining expansion boundary are documented in
[Phase 1 implementation status](docs/product/phase1.md).

## Quick start

Requires Python 3.11+ and `uv` (recommended).

```powershell
cd 'C:\Users\omarh\Documents\New project\neighborhood-intelligence'
uv sync --all-groups --extra geospatial
uv run nii init
uv run nii register-sources
uv run nii ingest-acs --state 11
uv run nii ingest-lodes --state dc --year 2023
uv run nii build-profile
uv run nii export-profile
uv run pytest
```

`--state 11` is a small reproducibility smoke run for the District of Columbia. Omit `--state` to run all configured states. Census currently requires a `CENSUS_API_KEY` for data queries; keep it only in the ignored local `.env` or a production secret manager. Results are in `data/warehouse/nii.duckdb` and `data/published/tract_year_profile.parquet`.

Load tract geometry plus official Census-place and CBSA context after the data-only smoke run. The command requires the declared `geospatial` extra:

```powershell
uv run nii ingest-geography --state 11
```

## Guardrails

ACS 5-year releases overlap; the profile labels each source window and does not present consecutive vintages as independent annual observations. 2019-2023 uses 2010 tract geography, while newer releases use 2020 geography; therefore cross-vintage trend output is deliberately flagged `GEOGRAPHY_NORMALIZATION_REQUIRED` until an approved relationship/crosswalk table is loaded.

Do not commit `data/raw`, source extracts, API keys, or licensed data. Read [architecture.md](docs/architecture.md), [data_sources.md](docs/data_sources.md), [geography.md](docs/geography.md), and [operations.md](docs/operations.md) before deploying.

Phase 2 design, coverage caveats, and the no-key LODES workflow are in [phase2_jobs.md](docs/phase2_jobs.md).
Phase 3's observed FHFA tract price-index foundation and market-data safeguards are in [phase3_housing.md](docs/phase3_housing.md).
Phase 4's resolution-safe FBI Crime Data Explorer baseline is in [phase4_public_safety.md](docs/phase4_public_safety.md).
Phase 5's county-native Census construction authorization layer is in [phase5_construction.md](docs/phase5_construction.md).

## Explore locally

After ingestion, run `uv run nii serve-dashboard` and open `http://127.0.0.1:8787`. Enter a tract (11 digits) or county (5 digits) GEOID and an as-of date. The dashboard selects the latest value that was available by that date and keeps the source geographic resolution visible; it never substitutes county QCEW values for tract values.
