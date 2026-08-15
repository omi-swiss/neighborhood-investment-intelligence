# Phase 5: construction and development

The initial development signal is the Census Building Permits Survey's annual county file, available through final 2025 estimates. It stores permits by structure type (1 unit, 2 units, 3–4 units, and 5+ units), authorized valuation, and the separate reported-unit fields supplied in the source.

```powershell
uv run nii ingest-bps
uv run nii build-construction
```

`analytics.county_year_construction` creates total authorized units, multifamily authorized units and share, total authorized valuation, and prior-year unit change. These are observed **permit authorizations** for new privately-owned residential construction, not starts, completions, occupied units, development proposals, or census-tract values. They remain county-native unless a separate documented spatial allocation is approved.
