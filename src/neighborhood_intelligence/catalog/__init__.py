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
    ("census_acs5", "U.S. Census Bureau", "American Community Survey 5-Year Data Profiles", "https://www.census.gov/programs-surveys/acs/data.html", "United States", "census tract", "2019-2024", "annual", "Public federal data; verify reuse terms", "Overlapping five-year samples; estimates include sampling error", "A", "variable-dependent", "https://www.census.gov/data/developers/data-sets/acs-5year.html"),
    ("census_lodes", "U.S. Census Bureau LEHD", "LEHD Origin-Destination Employment Statistics (LODES)", "https://lehd.ces.census.gov/data/lodes/LODES8/", "District of Columbia plus 50 states", "census block; aggregated to tract", "2002-2023 where published", "release-dependent", "Public federal data; verify reuse terms", "Administrative/tabulated employment data; coverage gaps exist by state/year and no sampling MOE is available", "A", "state-year dependent", "https://lehd.ces.census.gov/doc/help/onthemap/LODESTechDoc.pdf"),
    ("census_tiger", "U.S. Census Bureau", "TIGER/Line Shapefiles", "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html", "United States", "tract/place/county/CBSA", "vintage-dependent", "annual", "Public federal data; verify reuse terms", "Boundary vintages vary", "A", "high", "https://www.census.gov/programs-surveys/geography/guidance/tiger-line-documentation.html"),
    ("census_relationship", "U.S. Census Bureau", "Geographic Relationship Files", "https://www.census.gov/geographies/reference-files/time-series/geo/relationship-files.2020.html", "United States", "tract crosswalk", "2010-2020", "decennial/as released", "Public federal data; verify reuse terms", "2020 files do not include housing or population counts", "A", "vintage-dependent", "https://www.census.gov/data/developers/geography/about-geography.html"),
    ("bls_qcew", "U.S. Bureau of Labor Statistics", "Quarterly Census of Employment and Wages", "https://www.bls.gov/cew/overview.htm", "United States", "county", "2025 Q4 initial scope", "quarterly; published with a lag", "Public federal data; verify reuse terms", "County measures are not tract measures; suppression is retained as missing", "A", "county-quarter dependent", "https://www.bls.gov/cew/additional-resources/open-data/csv-data-slices.htm"),
    ("fhfa_hpi", "Federal Housing Finance Agency", "FHFA House Price Index, Annual Census Tracts", "https://www.fhfa.gov/data/hpi/datasets", "United States", "census tract", "annual; latest source vintage", "annual", "Public federal data", "Repeat-sales index measures price change, not a property valuation; tract geographic vintage is not supplied in the file", "A", "tract-year dependent", "https://www.fhfa.gov/data/hpi/datasets"),
    ("zillow_zori", "Zillow Research", "Zillow Observed Rent Index (ZORI), ZIP", "https://www.zillow.com/research/data/", "United States", "ZIP code", "2019-present retained; source history begins earlier", "monthly", "Public downloadable research data; verify current terms before redistribution", "A modeled typical-market-rent index, not a count of listings or a tract measure", "B", "ZIP-month dependent", "https://www.zillow.com/research/methodology-zori-repeat-rent-17553/"),
    ("zillow_zhvi", "Zillow Research", "Zillow Home Value Index (ZHVI), ZIP", "https://www.zillow.com/research/data/", "United States", "ZIP code", "2019-present retained; source history begins earlier", "monthly", "Public downloadable research data; verify current terms before redistribution", "A modeled typical-home-value index, not a sale-price table or tract measure", "B", "ZIP-month dependent", "https://www.zillow.com/research/zhvi-user-guide/"),
    ("fbi_cde", "Federal Bureau of Investigation", "Crime Data Explorer summarized crime", "https://cde.ucr.cjis.gov/", "United States", "state; agency future enhancement", "2020-present requested at ingestion", "monthly", "Public data accessed with a data.gov API key", "UCR participation is voluntary; reporting coverage, source refresh date, and state resolution must remain visible", "B", "state-month/category dependent", "https://www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/ucr/"),
    ("census_bps", "U.S. Census Bureau", "Building Permits Survey, annual county files", "https://www.census.gov/construction/bps/index.html", "United States", "county", "2020-2025 initial scope", "annual", "Public federal data", "Permits authorize new privately-owned residential construction; they are not starts, completions, or a tract measure", "A", "county-year dependent", "https://www.census.gov/construction/bps/about.html"),
    ("fhwa_nbi", "Federal Highway Administration", "National Bridge Inventory", "https://www.fhwa.dot.gov/bridge/nbi.cfm", "United States", "county", "2025 initial scope", "annual", "Public federal data", "Bridge condition is based on inspections and should not be read as a direct neighborhood-accessibility score", "A", "county-year dependent", "https://www.fhwa.dot.gov/bridge/britab.cfm/nbi/condition.cfm"),
    ("public_investment_registry", "Neighborhood Intelligence evidence registry", "Public capital and infrastructure projects", "manual-import://public-investment", "Configured project jurisdictions", "native project geography or point", "effective-date dependent", "as reviewed", "Row-level source terms apply", "A project can be proposed without committed funding; funding stages remain separate", "B", "review-dependent", "docs/phase6_infrastructure.md"),
    ("private_investment_registry", "Neighborhood Intelligence evidence registry", "Private development and employer investment projects", "manual-import://private-investment", "Configured project jurisdictions", "project point and county", "announcement-date dependent", "as reviewed", "Row-level source terms apply", "News-only records cannot be marked verified; announcements are not commitments", "B", "review-dependent", "docs/phase6_infrastructure.md"),
    ("regulatory_policy_registry", "Neighborhood Intelligence evidence registry", "Time-versioned housing and investment regulation", "manual-import://regulatory-policy", "Configured jurisdictions", "state, county, or city", "effective-date dependent", "as reviewed", "Official citations are linked; not legal advice", "Manual verification is required and legal interpretations may change", "C", "review-dependent", "docs/phase7_regulation_risk.md"),
    ("environmental_risk_registry", "Neighborhood Intelligence evidence registry", "Environmental, physical, and insurance risk observations", "manual-import://environmental-risk", "Configured source coverage", "source-native geography", "source-vintage dependent", "as reviewed", "Row-level source terms apply", "Assignment method and source resolution must be evaluated before comparison", "B", "metric-dependent", "docs/phase7_regulation_risk.md"),
)

PHASE8_OFFICIAL_SOURCES = (
    (
        "dc_building_permits", "District of Columbia Department of Buildings",
        "Building Permits", "https://opendata.dc.gov/", "District of Columbia",
        "permit point", "2025-present pilot", "daily",
        "CC BY 4.0; retain District attribution",
        "A permit is evidence of authorized work, not project cost, financing, completion, or an investment recommendation",
        "A", "record-dependent", "https://catalog.data.gov/dataset/building-permits-in-2026",
    ),
    (
        "fema_nfhl", "Federal Emergency Management Agency", "National Flood Hazard Layer",
        "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer",
        "United States", "flood-zone polygon", "current effective mapping",
        "as maps are revised", "Public federal data; retain FEMA source and map-vintage context",
        "A screening layer that does not replace a property-specific flood determination or insurance quote",
        "A", "map-vintage dependent", "https://msc.fema.gov/portal/resources/productsandtools",
    ),
    (
        "epa_frs", "U.S. Environmental Protection Agency",
        "Facility Registry Service state single-file CSV",
        "https://www.epa.gov/frs/epa-frs-facilities-state-single-file-csv-download",
        "United States", "facility point", "current registry", "monthly",
        "Public federal data; verify program-specific reuse terms",
        "FRS presence shows a program-linked facility, not proof of contamination, violation, or present health risk",
        "A", "program-dependent", "https://www.epa.gov/frs/frs-data-sources",
    ),
    (
        "sec_edgar", "U.S. Securities and Exchange Commission",
        "EDGAR submissions and company facts APIs", "https://data.sec.gov/",
        "United States", "company filing", "current filings", "near real time",
        "Public federal filings; follow SEC fair-access and user-agent policies",
        "Filings are discovery evidence until a location, amount, and project are verified",
        "A", "issuer-dependent",
        "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
    ),
    (
        "usaspending", "U.S. Department of the Treasury", "USAspending API",
        "https://api.usaspending.gov/", "United States", "award and place of performance",
        "current federal awards", "daily", "Public federal data; retain award lineage",
        "Award ceilings, obligations, outlays, recipient locations, and places of performance must remain distinct",
        "A", "award-dependent", "https://api.usaspending.gov/docs/endpoints",
    ),
    (
        "dc_property_itspe", "District of Columbia Office of Tax and Revenue",
        "Integrated Tax System Public Extract",
        "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/53",
        "District of Columbia", "parcel record", "current assessment roll", "daily",
        "CC BY 4.0; retain District and OTR attribution",
        "Assessment, tax, and recorded-sale context is not an active listing, appraisal, title report, or guarantee of accuracy",
        "A", "parcel-dependent",
        "https://otr.cfo.dc.gov/page/real-property-public-extract-records",
    ),
    (
        "dc_cama_residential", "District of Columbia Office of Tax and Revenue",
        "Computer Assisted Mass Appraisal - Residential",
        "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Property_and_Land_WebMercator/FeatureServer/25",
        "District of Columbia", "residential parcel record", "current assessment roll", "daily",
        "CC BY 4.0; retain District and OTR attribution",
        "CAMA facts and sale history are assessment-purpose records, not an appraisal or active listing",
        "A", "parcel-dependent",
        "https://catalog.data.gov/dataset/computer-assisted-mass-appraisal-residential-0dca4",
    ),
)
