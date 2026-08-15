# Operations and recovery

Run the local commands in the README. Production runs the same container with secrets injected by the platform, writes raw data to versioned object storage, and migrates PostGIS before the worker starts. Repoint a published export/API manifest to roll back an analytical release; never overwrite raw evidence.

Alert on failed or stale sources, checksum mismatch, state/year row-count drift, missing coverage, invalid GEOIDs, unmatched geometry, and material missingness changes. Each profile build persists actionable incomplete-metric and unreliable-MOE findings to `quality.data_quality_result`. Persist source/run/exception metadata and quarantine failures rather than dropping them.

Enable encrypted object versioning; take nightly Postgres logical backups to a separate location (35 daily, 12 monthly); snapshot before schema upgrades; and restore into isolation quarterly to validate recovery. Local DuckDB is a development cache, not the sole production backup.

Known Phase 1 limits: no LODES, prices/rents, crime, permits, regulations, or tract crosswalk yet. Place/CBSA assignments are available for loaded 2020-vintage tracts; 2010-vintage rows remain visibly unmapped until an approved crosswalk is loaded. No scores or investment advice are produced.
