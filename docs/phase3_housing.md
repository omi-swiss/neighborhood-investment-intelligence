# Phase 3: housing-market data and relative value

## Initial observed market layer

The first Phase 3 ingestion is FHFA's annual census-tract House Price Index (HPI):

```powershell
uv run nii register-sources
uv run nii ingest-fhfa-hpi
uv run nii build-profile
```

`standardized.fhfa_hpi_tract_observation` stores tract GEOID, reporting year, annual change, the current HPI level, rebased HPI levels when supplied, source publication date, source vintage, and ingestion lineage. `analytics.tract_year_market` exposes the annual observed HPI momentum.

The HPI is an area-level repeat-sales price-change index. It is not a sale-price table, property appraisal, rent estimate, cap rate, or a guarantee of appreciation. The current FHFA annual tract file does not supply a tract-boundary vintage, so it is intentionally not silently joined to ACS tract vintages; geographic normalization remains a separate, auditable step.

## Next market sources

FHFA supplies the official price-change backbone. Zillow's public ZIP-level ZORI and ZHVI adapters add monthly typical-market-rent and typical-home-value indices from January 2019 onward. Run them with:

```bash
uv run nii ingest-zillow-zori
uv run nii ingest-zillow-zhvi
uv run nii build-market
```

The results live in `standardized.zillow_zori_zip_observation`, `standardized.zillow_zhvi_zip_observation`, `analytics.zip_month_rent_market`, and `analytics.zip_month_housing_market`. The latter includes the price-to-monthly-rent index multiple only when both ZIP indices are available. It is context for comparing markets, not a cap rate, gross yield, sale price, property valuation, or a tract estimate. All Zillow observations deliberately remain ZIP-native.

Future adapters may add listings and market-time series at their published ZIP, neighborhood, county, city, or metro resolution. A documented crosswalk or aggregation rule is required before any such series is represented as tract data.

## Relative-value safeguards

The platform will not calculate a universal bargain score from HPI alone. A later relative-value model must compare like-for-like areas inside a metro and make its comparables, source dates, coverage, missingness, and assumptions visible. Until observed rent and sale/listing measures are loaded, no gross-yield, price-to-rent, cap-rate, or undervaluation estimate is produced.
