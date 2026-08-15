# Phase 1 runbook

Set `CENSUS_API_KEY` in a local `.env` (copy `.env.example`) before a tract-wide ACS run. Census requires a key for data queries. The client retains request lineage without the key, and it returns a safe `Census API rejected the configured API key` error if Census redirects an invalid key. Obtain and activate a key through the Census developer process; do not commit it.

```powershell
$env:PYTHONPATH = 'src'
$env:CENSUS_API_KEY = 'your-key-in-secret-store'
.\.venv\Scripts\python.exe -m neighborhood_intelligence.cli init
.\.venv\Scripts\python.exe -m neighborhood_intelligence.cli register-sources
.\.venv\Scripts\python.exe -m neighborhood_intelligence.cli ingest-acs --state 11
.\.venv\Scripts\python.exe -m neighborhood_intelligence.cli build-profile
.\.venv\Scripts\python.exe -m neighborhood_intelligence.cli export-profile
```

For the full national Phase 1 run, omit `--state`; the configuration intentionally contains the 50 states plus DC, not a hard-coded city list. First run one state/vintage and inspect `meta.ingestion_run`, `raw.source_asset`, record counts, and quality flags. The five configured vintages are 2019-2023. Load TIGER geometry separately with `ingest-geography` after installing the `geospatial` optional extra.

If an ingestion fails, retain the raw/error evidence, fix configuration or upstream access, and rerun the same state/year. The observation primary key makes a successful re-ingestion idempotent. Do not infer that a failed API run yielded zero observations.
