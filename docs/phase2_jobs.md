# Phase 2: jobs, commuting, and accessibility

## Scope

Phase 2 introduces Census LEHD Origin-Destination Employment Statistics (LODES) as the national employment and commuting source. The initial implementation ingests the `JT00` all-jobs series for five configurable reporting years, preserves RAC/WAC state version metadata and checksums, then aggregates blocks to 2020 census tracts. OD-main and OD-aux flow files are opt-in because a national multi-year tract-pair backfill is materially larger than the worker/job-count layer.

No API key is required. LODES is published as official state-level compressed CSV files. The default configuration contains the 50 states plus DC using the upstream lowercase postal codes; use `--state` to constrain a smoke run.

```powershell
uv run nii ingest-lodes --state dc --year 2023
uv run nii build-profile
```

Use commuting flows only for the markets and years being analyzed:

```powershell
uv run nii ingest-lodes --state dc --year 2023 --include-flows
```

## Outputs

`standardized.lodes_tract_observation` retains separate `resident_workers` (RAC) and `workplace_jobs` (WAC) observations. `standardized.lodes_tract_flow` retains tract-pair OD flows. `analytics.tract_year_employment` exposes resident workers, workplace jobs, internal jobs, inbound workers, outbound workers, jobs-to-resident-workers ratio, and two reconciliation residuals. The residuals are surfaced rather than forced to zero.

`analytics.employment_center` and `analytics.tract_employment_accessibility` provide the first accessibility measure. A center is a 2023 `JT00` workplace tract with at least 5,000 jobs; the threshold is configuration-driven and written into every result. The accessibility result is geodesic centroid distance to the nearest such tract. It is deliberately labeled as proximity, not a route, frequency, or travel-time estimate.

## Coverage and safeguards

LODES 8.4 uses 2020 census blocks and 2024 TIGER/Line geography. It covers DC and the 50 states, but state/year availability is not universal: Alaska has no OD/WAC for 2017-2023, and Alaska and Michigan have no OD/WAC for 2022-2023. The pipeline records unavailable official files as `PARTIAL` ingestion runs; it never converts missing files to zero jobs.

RAC counts covered jobs associated with worker residence; WAC counts covered jobs associated with workplaces; OD connects workplace and residence blocks. They are not interchangeable with ACS employment estimates, do not carry ACS sampling MOEs, and should not be interpreted as total employment or individual people. All outputs retain the release hash and raw files for reproducibility.

## Accessibility next

The next Phase 2 increment is transit-stop proximity and schedule-based travel times. It will use configured official agency GTFS feeds; because transit feed quality varies by agency, no universal route or travel-time estimate will be claimed until that city feed is validated. The first proposed validation market is WMATA, whose official current GTFS API requires a free agency API key. This key must be supplied before that feed is ingested. A user-facing dashboard can begin locally without a key; a later hosted basemap/geocoder decision may require a provider key and will be presented for approval first.

## Mixed-vintage observations and county indicators

The serving layer is deliberately mixed-vintage: `analytics.observation_as_of` exposes every source with its reference period, release date, source vintage, geographic resolution, and observation type. It does not fabricate a 2026 tract value when the newest tract estimate is ACS 2024. A 2026 request instead returns the latest data that was actually available by the selected date, such as a county-level QCEW employment measure, and labels it as county-level.

The `ingest-qcew` command retrieves BLS's all-industries total-covered county slice. It retains establishments, each monthly employment level, quarterly wages, and average weekly wages; suppressed cells stay suppressed. The initial default is 2025 Q4, released June 2, 2026:

```powershell
uv run nii ingest-qcew
uv run nii serve-dashboard
```

`standardized.estimated_observation` is reserved for a future validated nowcast or forecast. It requires an explicit `NOWCAST` or `FORECAST` type, bounds, and method version. No model is currently permitted to silently overwrite an observed ACS, LODES, or QCEW value.
