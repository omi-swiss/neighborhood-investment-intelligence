from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Metric:
    metric_id: str
    variable: str
    table: str
    universe: str
    numerator_variable: str | None = None
    denominator_variable: str | None = None
    formula: str | None = None


# Variables are verified against each vintage's groups/B*.json metadata during ingestion.
METRICS: tuple[Metric, ...] = (
    Metric("population", "B01003_001", "B01003", "Total population"),
    Metric("households", "B11001_001", "B11001", "Households"),
    Metric("median_age", "B01002_001", "B01002", "Median age"),
    Metric("median_household_income", "B19013_001", "B19013", "Households"),
    Metric("per_capita_income", "B19301_001", "B19301", "Population for whom poverty status is determined"),
    Metric("poverty_population", "B17001_001", "B17001", "Population for whom poverty status is determined"),
    Metric("poverty_population_below", "B17001_002", "B17001", "Population for whom poverty status is determined"),
    Metric("civilian_labor_force", "B23025_003", "B23025", "Population 16 years and over"),
    Metric("employed", "B23025_004", "B23025", "Population 16 years and over"),
    Metric("unemployed", "B23025_005", "B23025", "Population 16 years and over"),
    Metric("housing_units", "B25001_001", "B25001", "Housing units"),
    Metric("occupied_housing_units", "B25002_002", "B25002", "Housing units"),
    Metric("vacant_housing_units", "B25002_003", "B25002", "Housing units"),
    Metric("owner_occupied_units", "B25003_002", "B25003", "Occupied housing units"),
    Metric("renter_occupied_units", "B25003_003", "B25003", "Occupied housing units"),
    Metric("median_gross_rent", "B25064_001", "B25064", "Renter-occupied units paying cash rent"),
    Metric("median_home_value", "B25077_001", "B25077", "Owner-occupied units"),
)

OFFICIAL_SOURCES = (
    ("census_acs5", "U.S. Census Bureau", "American Community Survey 5-Year Data Profiles", "https://www.census.gov/programs-surveys/acs/data.html", "tract", "2019-2023 initial scope", "annual", "Public federal data; verify reuse terms", "Overlapping five-year samples; estimates include sampling error", "A", "variable-dependent", "https://www.census.gov/data/developers/data-sets/acs-5year.html"),
    ("census_lodes", "U.S. Census Bureau LEHD", "LEHD Origin-Destination Employment Statistics (LODES)", "https://lehd.ces.census.gov/data/lodes/LODES8/", "block; aggregated to tract", "2002-2023 where published", "release-dependent", "Public federal data; verify reuse terms", "Administrative/tabulated employment data; coverage gaps exist by state/year and no sampling MOE is available", "A", "state-year dependent", "https://lehd.ces.census.gov/doc/help/onthemap/LODESTechDoc.pdf"),
    ("census_tiger", "U.S. Census Bureau", "TIGER/Line Shapefiles", "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html", "tract/place/county/CBSA", "vintage-dependent", "annual", "Public federal data; verify reuse terms", "Boundary vintages vary", "A", "high", "https://www.census.gov/programs-surveys/geography/guidance/tiger-line-documentation.html"),
    ("census_relationship", "U.S. Census Bureau", "Geographic Relationship Files", "https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html", "tract crosswalk", "2010-2020", "decennial/as released", "Public federal data; verify reuse terms", "2020 files do not include housing or population counts", "A", "vintage-dependent", "https://www.census.gov/data/developers/geography/about-geography.html"),
)

PHASE8_OFFICIAL_SOURCES = (
    (
        "dc_building_permits",
        "District of Columbia Department of Buildings",
        "Building Permits",
        "https://opendata.dc.gov/",
        "District of Columbia",
        "permit point",
        "2025-present pilot",
        "daily",
        "CC BY 4.0; retain District attribution",
        "A permit is evidence of authorized work, not project cost, financing, completion, or an investment recommendation",
        "A",
        "record-dependent",
        "https://catalog.data.gov/dataset/building-permits-in-2026",
    ),
    (
        "fema_nfhl",
        "Federal Emergency Management Agency",
        "National Flood Hazard Layer",
        "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer",
        "United States",
        "flood-zone polygon",
        "current effective mapping",
        "as maps are revised",
        "Public federal data; retain FEMA source and map-vintage context",
        "A screening layer that does not replace a property-specific flood determination or insurance quote",
        "A",
        "map-vintage dependent",
        "https://msc.fema.gov/portal/resources/productsandtools",
    ),
    (
        "epa_frs",
        "U.S. Environmental Protection Agency",
        "Facility Registry Service state single-file CSV",
        "https://www.epa.gov/frs/epa-frs-facilities-state-single-file-csv-download",
        "United States",
        "facility point",
        "current registry",
        "monthly",
        "Public federal data; verify program-specific reuse terms",
        "FRS presence shows a program-linked facility, not proof of contamination, violation, or present health risk",
        "A",
        "program-dependent",
        "https://www.epa.gov/frs/frs-data-sources",
    ),
    (
        "sec_edgar",
        "U.S. Securities and Exchange Commission",
        "EDGAR submissions and company facts APIs",
        "https://data.sec.gov/",
        "United States",
        "company filing",
        "current filings",
        "near real time",
        "Public federal filings; follow SEC fair-access and user-agent policies",
        "Filings are discovery evidence until a location, amount, and project are verified",
        "A",
        "issuer-dependent",
        "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
    ),
    (
        "usaspending",
        "U.S. Department of the Treasury",
        "USAspending API",
        "https://api.usaspending.gov/",
        "United States",
        "award and place of performance",
        "current federal awards",
        "daily",
        "Public federal data; retain award lineage",
        "Award ceilings, obligations, outlays, recipient locations, and places of performance must remain distinct",
        "A",
        "award-dependent",
        "https://api.usaspending.gov/docs/endpoints",
    ),
)
