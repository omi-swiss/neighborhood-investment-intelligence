# Data-source catalogue

| Domain | Source | Resolution | Key safeguard |
| --- | --- | --- | --- |
| Demographics, economics, housing, resident employment | [Census ACS 5-Year API](https://www.census.gov/data/developers/data-sets/acs-5year.html) | Tract, annual release | Preserve estimate, MOE, universe and overlapping five-year window. |
| Workplace jobs, resident workers, and commuting flows | [Census LEHD LODES 8](https://lehd.ces.census.gov/data/lodes/LODES8/) | Census block, aggregated to tract | Preserve RAC/WAC/OD files, release version, checksum, and state/year coverage gap; do not treat covered jobs as total employment. |
| Boundaries | [Census TIGER/Line](https://www.census.gov/geographies/mapping-files/2023/geo/tiger-line-file.html) | Vintage-specific geography | Geometry does not supply demographics; retain vintage. |
| Crosswalks | [Census relationship files](https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html) | Tract relationships | Choose an explicit weighting method; 2020 files do not supply population/housing counts. |
| Migration | [IRS Statistics of Income county migration, 2022–2023](https://www.irs.gov/statistics/soi-tax-stats-migration-data-2022-2023) | County and county-equivalent | Retain the released flow type, IRS observation period, and source geography. Where a city spans counties, label the summed values as a multi-county proxy; do not present them as exact city-boundary totals. |
| Inflation | [BLS CPI](https://www.bls.gov/cpi/) | National, monthly/annual | Current fixed annual CPI-U mapping must become a versioned BLS ingestion before production claims. |

The metadata catalog retains publisher, URL, coverage, resolution, frequency, licensing note, limitation, ratings, last ingestion, and expected release. Do not add commercial data without a completed licensing and redistribution review.
