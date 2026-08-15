# Phase 4: public safety

The initial public-safety layer uses the FBI Crime Data Explorer's summarized violent- and property-crime series. It is intentionally stored at the reported **state-month** resolution. It is not a crime score, a tract measure, or a substitute for a local incident dataset.

```powershell
uv run nii ingest-fbi-cde
uv run nii build-public-safety
```

`FBI_CDE_API_KEY` must remain in the ignored local `.env`. Each observation retains reported offenses, clearances, rates per 100,000 people, population, participating population, and the FBI-provided reporting-coverage percentage. The analytical status flags coverage below 90 percent rather than silently treating incomplete agency participation as a complete statewide measure.

Agency-level and incident-level sources may later be added for selected markets only after their jurisdiction boundary, reporting coverage, and licensing/retention terms are validated. No state- or agency-level crime statistic may be assigned to a census tract without an explicit, auditable geographic rule.
