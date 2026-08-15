from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import duckdb
import numpy as np

from ..catalog import METRICS


# Annual CPI-U values. Phase 1 records this as a documented interim source until BLS ingestion is added.
CPI_U = {2019: 255.657, 2020: 258.811, 2021: 270.970, 2022: 292.655, 2023: 304.702, 2024: 313.689}


# FIPS state context keeps public exports readable without relying on a BI tool's
# implicit geographic-role lookup. Territories are included for future coverage.
STATE_FIPS_CONTEXT = {
    "01": ("AL", "Alabama"), "02": ("AK", "Alaska"), "04": ("AZ", "Arizona"),
    "05": ("AR", "Arkansas"), "06": ("CA", "California"), "08": ("CO", "Colorado"),
    "09": ("CT", "Connecticut"), "10": ("DE", "Delaware"), "11": ("DC", "District of Columbia"),
    "12": ("FL", "Florida"), "13": ("GA", "Georgia"), "15": ("HI", "Hawaii"),
    "16": ("ID", "Idaho"), "17": ("IL", "Illinois"), "18": ("IN", "Indiana"),
    "19": ("IA", "Iowa"), "20": ("KS", "Kansas"), "21": ("KY", "Kentucky"),
    "22": ("LA", "Louisiana"), "23": ("ME", "Maine"), "24": ("MD", "Maryland"),
    "25": ("MA", "Massachusetts"), "26": ("MI", "Michigan"), "27": ("MN", "Minnesota"),
    "28": ("MS", "Mississippi"), "29": ("MO", "Missouri"), "30": ("MT", "Montana"),
    "31": ("NE", "Nebraska"), "32": ("NV", "Nevada"), "33": ("NH", "New Hampshire"),
    "34": ("NJ", "New Jersey"), "35": ("NM", "New Mexico"), "36": ("NY", "New York"),
    "37": ("NC", "North Carolina"), "38": ("ND", "North Dakota"), "39": ("OH", "Ohio"),
    "40": ("OK", "Oklahoma"), "41": ("OR", "Oregon"), "42": ("PA", "Pennsylvania"),
    "44": ("RI", "Rhode Island"), "45": ("SC", "South Carolina"), "46": ("SD", "South Dakota"),
    "47": ("TN", "Tennessee"), "48": ("TX", "Texas"), "49": ("UT", "Utah"),
    "50": ("VT", "Vermont"), "51": ("VA", "Virginia"), "53": ("WA", "Washington"),
    "54": ("WV", "West Virginia"), "55": ("WI", "Wisconsin"), "56": ("WY", "Wyoming"),
    "60": ("AS", "American Samoa"), "66": ("GU", "Guam"), "69": ("MP", "Northern Mariana Islands"),
    "72": ("PR", "Puerto Rico"), "78": ("VI", "U.S. Virgin Islands"),
}


def deflate(nominal: float | None, year: int, reference_year: int) -> float | None:
    if nominal is None:
        return None
    return nominal * CPI_U[reference_year] / CPI_U[year]


def build_profile(
    conn: duckdb.DuckDBPyConnection,
    reference_year: int,
    caution_relative_moe: float = 0.20,
    unreliable_relative_moe: float = 0.40,
) -> None:
    """Build a tract-year profile without hiding missingness or ACS uncertainty."""
    conn.execute("DROP TABLE IF EXISTS analytics.tract_year_profile")
    conn.execute(
        """
        CREATE TABLE analytics.tract_year_profile AS
        WITH profile_base AS (
          SELECT tract_geoid, reporting_year, geography_vintage,
            max(CASE WHEN metric_id='population' THEN estimate END) AS population,
            max(CASE WHEN metric_id='population' THEN margin_of_error END) AS population_moe,
            max(CASE WHEN metric_id='households' THEN estimate END) AS household_count,
            max(CASE WHEN metric_id='median_age' THEN estimate END) AS median_age,
            max(CASE WHEN metric_id='median_household_income' THEN estimate END) AS median_household_income,
            max(CASE WHEN metric_id='median_household_income' THEN margin_of_error END) AS median_household_income_moe,
            max(CASE WHEN metric_id='per_capita_income' THEN estimate END) AS per_capita_income,
            max(CASE WHEN metric_id='poverty_population_below' THEN estimate END)
              / nullif(max(CASE WHEN metric_id='poverty_population' THEN estimate END), 0) AS poverty_rate,
            max(CASE WHEN metric_id='civilian_labor_force' THEN estimate END) AS civilian_labor_force,
            max(CASE WHEN metric_id='employed' THEN estimate END) AS employed_residents,
            max(CASE WHEN metric_id='unemployed' THEN estimate END)
              / nullif(max(CASE WHEN metric_id='civilian_labor_force' THEN estimate END), 0) AS unemployment_rate,
            max(CASE WHEN metric_id='housing_units' THEN estimate END) AS housing_units,
            max(CASE WHEN metric_id='occupied_housing_units' THEN estimate END) AS occupied_housing_units,
            max(CASE WHEN metric_id='vacant_housing_units' THEN estimate END)
              / nullif(max(CASE WHEN metric_id='housing_units' THEN estimate END), 0) AS vacancy_rate,
            max(CASE WHEN metric_id='renter_occupied_units' THEN estimate END)
              / nullif(max(CASE WHEN metric_id='occupied_housing_units' THEN estimate END), 0) AS renter_share,
            max(CASE WHEN metric_id='owner_occupied_units' THEN estimate END)
              / nullif(max(CASE WHEN metric_id='occupied_housing_units' THEN estimate END), 0) AS owner_share,
            max(CASE WHEN metric_id='median_gross_rent' THEN estimate END) AS median_gross_rent,
            max(CASE WHEN metric_id='median_home_value' THEN estimate END) AS median_home_value,
            min(observation_start) AS observation_start, max(observation_end) AS observation_end,
            max(publication_date) AS publication_date, max(ingestion_run_id) AS ingestion_run_id,
            count(DISTINCT metric_id) AS observed_metric_count,
            count(DISTINCT ingestion_run_id) AS source_run_count
          FROM standardized.acs_observation
          GROUP BY tract_geoid, reporting_year, geography_vintage
        ), geography_context AS (
          SELECT assignment.subject_geography_id,
            max(CASE WHEN assignment.assignment_type='place' THEN geography.geoid END) AS city_geoid,
            max(CASE WHEN assignment.assignment_type='place' THEN geography.name END) AS city,
            max(CASE WHEN assignment.assignment_type='cbsa' THEN geography.geoid END) AS metro_geoid,
            max(CASE WHEN assignment.assignment_type='cbsa' THEN geography.name END) AS metro
          FROM standardized.geography_assignment AS assignment
          JOIN standardized.geography AS geography
            ON geography.geography_id = assignment.assigned_geography_id
          GROUP BY assignment.subject_geography_id
        )
        SELECT profile_base.*, geography_context.city_geoid, geography_context.city,
          geography_context.metro_geoid, geography_context.metro,
          observed_metric_count::DOUBLE / ? AS metric_coverage,
          CASE WHEN observed_metric_count = ? THEN 'COMPLETE' ELSE 'INCOMPLETE' END AS data_completeness,
          CASE
            WHEN population IS NULL OR population_moe IS NULL OR population = 0 THEN 'NOT_AVAILABLE'
            WHEN abs(population_moe / population) >= ? THEN 'UNRELIABLE'
            WHEN abs(population_moe / population) >= ? THEN 'CAUTION'
            ELSE 'RELIABLE'
          END AS population_reliability,
          CASE
            WHEN median_household_income IS NULL OR median_household_income_moe IS NULL OR median_household_income = 0 THEN 'NOT_AVAILABLE'
            WHEN abs(median_household_income_moe / median_household_income) >= ? THEN 'UNRELIABLE'
            WHEN abs(median_household_income_moe / median_household_income) >= ? THEN 'CAUTION'
            ELSE 'RELIABLE'
          END AS income_reliability,
          CASE
            WHEN geography_context.city_geoid IS NULL OR geography_context.metro_geoid IS NULL
              THEN 'CONTEXT_MAPPING_NOT_AVAILABLE'
            ELSE 'MAPPED'
          END AS geography_context_status
        FROM profile_base
        LEFT JOIN geography_context
          ON geography_context.subject_geography_id =
             'tract:' || profile_base.tract_geoid || ':' || profile_base.geography_vintage
        """,
        [
            len(METRICS), len(METRICS), unreliable_relative_moe, caution_relative_moe,
            unreliable_relative_moe, caution_relative_moe,
        ],
    )
    for column in (
        "median_household_income_real",
        "per_capita_income_real",
        "median_gross_rent_real",
        "median_home_value_real",
    ):
        conn.execute(f"ALTER TABLE analytics.tract_year_profile ADD COLUMN {column} DOUBLE")
    for year, cpi in CPI_U.items():
        conn.execute(
            """
            UPDATE analytics.tract_year_profile
            SET median_household_income_real = median_household_income * ? / ?,
                per_capita_income_real = per_capita_income * ? / ?,
                median_gross_rent_real = median_gross_rent * ? / ?,
                median_home_value_real = median_home_value * ? / ?
            WHERE reporting_year = ?
            """,
            [
                CPI_U[reference_year], cpi, CPI_U[reference_year], cpi,
                CPI_U[reference_year], cpi, CPI_U[reference_year], cpi, year,
            ],
        )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.tract_year_trend AS
        SELECT *,
          population - lag(population) OVER w AS population_change_prior_vintage,
          median_household_income_real - lag(median_household_income_real) OVER w AS real_income_change_prior_vintage,
          CASE WHEN lag(geography_vintage) OVER w IS NULL THEN 'NO_PRIOR_VINTAGE'
               WHEN geography_vintage <> lag(geography_vintage) OVER w THEN 'GEOGRAPHY_NORMALIZATION_REQUIRED'
               ELSE 'ACS_WINDOWS_OVERLAP' END AS comparability_warning
        FROM analytics.tract_year_profile
        WINDOW w AS (PARTITION BY tract_geoid ORDER BY reporting_year)
        """
    )
def export_profile(conn: duckdb.DuckDBPyConnection, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    escaped = str(destination).replace("'", "''")
    conn.execute(f"COPY analytics.tract_year_trend TO '{escaped}' (FORMAT PARQUET, COMPRESSION ZSTD)")


def export_private_investment_pins(conn: duckdb.DuckDBPyConnection, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    escaped = str(destination).replace("'", "''")
    conn.execute(f"COPY analytics.private_investment_map_pin TO '{escaped}' (HEADER, DELIMITER ',')")


def export_tableau_tract_map(conn: duckdb.DuckDBPyConnection, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    escaped = str(destination).replace("'", "''")
    conn.execute(
        f"""
        COPY (
          SELECT profile.*, geography.centroid_lon AS longitude, geography.centroid_lat AS latitude
          FROM analytics.tract_year_profile AS profile
          JOIN standardized.geography AS geography
            ON geography.geography_id = 'tract:' || profile.tract_geoid || ':' || profile.geography_vintage
          QUALIFY row_number() OVER (PARTITION BY profile.tract_geoid ORDER BY profile.reporting_year DESC) = 1
        ) TO '{escaped}' (HEADER, DELIMITER ',')
        """
    )


def export_tableau_tract_boundaries(
    conn: duckdb.DuckDBPyConnection,
    destination: Path,
    simplify_tolerance: float = 0.003,
) -> None:
    """Write the latest tract profile with simplified tract polygons for Tableau.

    The point-map CSV remains the fast national overview.  This spatial extract is
    intentionally simplified in WGS84 so Tableau can render a tract choropleth
    without making the workbook depend on a local TIGER archive.
    """
    try:
        import geopandas as gpd
    except ImportError as error:
        raise RuntimeError("Install the geospatial extra: uv sync --extra geospatial") from error

    destination.parent.mkdir(parents=True, exist_ok=True)
    frame = conn.execute(
        """
        SELECT profile.*, geography.geometry_wkt
        FROM analytics.tract_year_profile AS profile
        JOIN standardized.geography AS geography
          ON geography.geography_id = 'tract:' || profile.tract_geoid || ':' || profile.geography_vintage
        WHERE geography.geometry_wkt IS NOT NULL
        QUALIFY row_number() OVER (PARTITION BY profile.tract_geoid ORDER BY profile.reporting_year DESC) = 1
        """
    ).fetchdf()
    if frame.empty:
        raise RuntimeError("No tract geometries are available for the Tableau boundary export")

    geometry = gpd.GeoSeries.from_wkt(frame.pop("geometry_wkt"), crs="EPSG:4269")
    boundaries = gpd.GeoDataFrame(frame, geometry=geometry).to_crs("EPSG:4326")
    if simplify_tolerance > 0:
        boundaries.geometry = boundaries.geometry.simplify(
            simplify_tolerance, preserve_topology=True
        )
    boundaries = boundaries[~boundaries.geometry.is_empty]
    boundaries.to_file(destination, driver="GeoJSON", index=False)


def county_overview_frame(conn: duckdb.DuckDBPyConnection):
    """Return one readable, latest-profile county record for BI tools."""
    measures = conn.execute(
        """
        WITH latest AS (
          SELECT *
          FROM analytics.tract_year_profile
          QUALIFY row_number() OVER (
            PARTITION BY tract_geoid ORDER BY reporting_year DESC
          ) = 1
        ),
        county_metrics AS (
          SELECT
            substr(tract_geoid, 1, 5) AS county_geoid,
            max(reporting_year) AS reporting_year,
            sum(population) AS population,
            sum(household_count) AS household_count,
            sum(housing_units) AS housing_units,
            sum(occupied_housing_units) AS occupied_housing_units,
            sum(civilian_labor_force) AS civilian_labor_force,
            sum(employed_residents) AS employed_residents,
            sum(median_household_income * household_count)
              / nullif(sum(household_count), 0) AS avg_household_income,
            sum(median_home_value * occupied_housing_units)
              / nullif(sum(occupied_housing_units), 0) AS avg_home_value,
            sum(poverty_rate * population) / nullif(sum(population), 0) AS poverty_rate,
            sum(vacancy_rate * housing_units) / nullif(sum(housing_units), 0) AS vacancy_rate,
            sum(unemployment_rate * civilian_labor_force)
              / nullif(sum(civilian_labor_force), 0) AS unemployment_rate,
            avg(metric_coverage) AS metric_coverage
          FROM latest
          GROUP BY 1
        ),
        city_ranked AS (
          SELECT
            substr(tract_geoid, 1, 5) AS county_geoid,
            city AS primary_place_context,
            sum(population) AS place_context_population,
            row_number() OVER (
              PARTITION BY substr(tract_geoid, 1, 5)
              ORDER BY sum(population) DESC, city
            ) AS row_num
          FROM latest
          WHERE city IS NOT NULL
          GROUP BY 1, 2
        ),
        metro_ranked AS (
          SELECT
            substr(tract_geoid, 1, 5) AS county_geoid,
            metro AS metro_context,
            row_number() OVER (
              PARTITION BY substr(tract_geoid, 1, 5)
              ORDER BY sum(population) DESC, metro
            ) AS row_num
          FROM latest
          WHERE metro IS NOT NULL
          GROUP BY 1, 2
        ),
        county_names AS (
          SELECT county_geoid, county_name
          FROM standardized.census_bps_county_annual_observation
          QUALIFY row_number() OVER (
            PARTITION BY county_geoid ORDER BY reporting_year DESC
          ) = 1
        )
        SELECT
          metrics.*,
          coalesce(names.county_name, 'County FIPS ' || metrics.county_geoid) AS county_name,
          city.primary_place_context,
          metro.metro_context
        FROM county_metrics AS metrics
        LEFT JOIN county_names AS names USING (county_geoid)
        LEFT JOIN city_ranked AS city ON city.county_geoid = metrics.county_geoid AND city.row_num = 1
        LEFT JOIN metro_ranked AS metro ON metro.county_geoid = metrics.county_geoid AND metro.row_num = 1
        """
    ).fetchdf()
    measures["state_fips"] = measures["county_geoid"].str[:2]
    measures["state_abbr"] = measures["state_fips"].map(
        lambda value: STATE_FIPS_CONTEXT.get(value, (None, None))[0]
    )
    measures["state_name"] = measures["state_fips"].map(
        lambda value: STATE_FIPS_CONTEXT.get(value, (None, None))[1]
    )
    measures["county_display_name"] = measures["county_name"] + ", " + measures["state_abbr"].fillna("")
    return measures


def export_powerbi_county_overview(conn: duckdb.DuckDBPyConnection, destination: Path) -> None:
    """Write a flat county table for Power BI models and filtering."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    counties = county_overview_frame(conn)
    counties["county_id"] = "county:" + counties["county_geoid"]
    counties["state_id"] = "state:" + counties["state_fips"]
    counties.to_csv(destination, index=False)


def export_powerbi_tract_overview(conn: duckdb.DuckDBPyConnection, destination: Path) -> None:
    """Write a tract fact table with durable county/state relationship keys."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    tracts = conn.execute(
        """
        SELECT profile.*, geography.centroid_lon AS longitude, geography.centroid_lat AS latitude
        FROM analytics.tract_year_profile AS profile
        JOIN standardized.geography AS geography
          ON geography.geography_id = 'tract:' || profile.tract_geoid || ':' || profile.geography_vintage
        QUALIFY row_number() OVER (PARTITION BY profile.tract_geoid ORDER BY profile.reporting_year DESC) = 1
        """
    ).fetchdf()
    counties = county_overview_frame(conn)[
        ["county_geoid", "county_name", "state_name", "state_abbr", "primary_place_context"]
    ]
    tracts["county_geoid"] = tracts["tract_geoid"].str[:5]
    tracts["tract_id"] = "tract:" + tracts["tract_geoid"]
    tracts["county_id"] = "county:" + tracts["county_geoid"]
    tracts = tracts.merge(counties, on="county_geoid", how="left")
    tracts.to_csv(destination, index=False)


def export_tableau_county_overview(
    conn: duckdb.DuckDBPyConnection,
    destination: Path,
    simplify_tolerance: float = 0.003,
) -> None:
    """Write a lighter county choropleth with population-weighted tract measures."""
    try:
        import geopandas as gpd
    except ImportError as error:
        raise RuntimeError("Install the geospatial extra: uv sync --extra geospatial") from error

    destination.parent.mkdir(parents=True, exist_ok=True)
    measures = county_overview_frame(conn)
    geometry_rows = conn.execute(
        """
        SELECT substr(geoid, 1, 5) AS county_geoid, geometry_wkt
        FROM standardized.geography
        WHERE geography_type='tract' AND geometry_wkt IS NOT NULL
        """
    ).fetchdf()
    if geometry_rows.empty:
        raise RuntimeError("No tract geometries are available for the county overview")

    geometry = gpd.GeoSeries.from_wkt(geometry_rows.pop("geometry_wkt"), crs="EPSG:4269")
    tracts = gpd.GeoDataFrame(geometry_rows, geometry=geometry).to_crs("EPSG:4326")
    if simplify_tolerance > 0:
        tracts.geometry = tracts.geometry.simplify(simplify_tolerance, preserve_topology=True)
    counties = tracts.dissolve(by="county_geoid", as_index=False)
    counties = counties.merge(measures, on="county_geoid", how="inner")
    counties.to_file(destination, driver="GeoJSON", index=False)


def build_employment_profile(conn: duckdb.DuckDBPyConnection) -> None:
    """Build LODES employment measures without conflating residents and jobs."""
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.tract_year_employment AS
        WITH observations AS (
          SELECT tract_geoid, reporting_year, geography_vintage,
            sum(CASE WHEN measure_type='resident_workers' THEN estimate ELSE 0 END) AS resident_workers,
            sum(CASE WHEN measure_type='workplace_jobs' THEN estimate ELSE 0 END) AS workplace_jobs,
            count(DISTINCT source_state) AS observation_source_states,
            max(source_vintage) AS source_vintage
          FROM standardized.lodes_tract_observation
          WHERE job_type='JT00'
          GROUP BY tract_geoid, reporting_year, geography_vintage
        ), flows AS (
          SELECT reporting_year, geography_vintage, workplace_tract_geoid AS tract_geoid,
            sum(CASE WHEN workplace_tract_geoid = residence_tract_geoid THEN total_jobs ELSE 0 END) AS internal_jobs,
            sum(CASE WHEN workplace_tract_geoid <> residence_tract_geoid THEN total_jobs ELSE 0 END) AS worker_inflows
          FROM standardized.lodes_tract_flow
          WHERE job_type='JT00'
          GROUP BY reporting_year, geography_vintage, workplace_tract_geoid
        ), outflows AS (
          SELECT reporting_year, geography_vintage, residence_tract_geoid AS tract_geoid,
            sum(CASE WHEN workplace_tract_geoid <> residence_tract_geoid THEN total_jobs ELSE 0 END) AS worker_outflows
          FROM standardized.lodes_tract_flow
          WHERE job_type='JT00'
          GROUP BY reporting_year, geography_vintage, residence_tract_geoid
        )
        SELECT observations.*, coalesce(flows.internal_jobs, 0) AS internal_jobs,
          coalesce(flows.worker_inflows, 0) AS worker_inflows,
          coalesce(outflows.worker_outflows, 0) AS worker_outflows,
          workplace_jobs / nullif(resident_workers, 0) AS jobs_to_resident_workers_ratio,
          workplace_jobs - coalesce(flows.internal_jobs, 0) - coalesce(flows.worker_inflows, 0) AS workplace_flow_residual,
          resident_workers - coalesce(flows.internal_jobs, 0) - coalesce(outflows.worker_outflows, 0) AS residence_flow_residual
        FROM observations
        LEFT JOIN flows USING (tract_geoid, reporting_year, geography_vintage)
        LEFT JOIN outflows USING (tract_geoid, reporting_year, geography_vintage)
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.tract_year_employment_trend AS
        SELECT *,
          workplace_jobs - lag(workplace_jobs) OVER w AS workplace_job_change_prior_year,
          resident_workers - lag(resident_workers) OVER w AS resident_worker_change_prior_year
        FROM analytics.tract_year_employment
        WINDOW w AS (PARTITION BY tract_geoid ORDER BY reporting_year)
        """
    )


def build_market_profile(conn: duckdb.DuckDBPyConnection) -> None:
    """Expose native-geography market indices without turning them into valuations."""
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.tract_year_market AS
        SELECT *,
          hpi - lag(hpi) OVER w AS hpi_change_prior_year,
          CASE
            WHEN lag(hpi) OVER w IS NULL THEN 'NO_PRIOR_YEAR'
            WHEN hpi IS NULL THEN 'NOT_AVAILABLE'
            ELSE 'OBSERVED_INDEX'
          END AS hpi_data_status
        FROM standardized.fhfa_hpi_tract_observation
        WINDOW w AS (PARTITION BY tract_geoid ORDER BY reporting_year)
        """
    )


    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.zip_month_rent_market AS
        SELECT *,
          (zori / lag(zori, 12) OVER w - 1) * 100 AS zori_change_prior_year_pct,
          CASE
            WHEN lag(zori, 12) OVER w IS NULL THEN 'NO_PRIOR_YEAR'
            ELSE 'OBSERVED_INDEX'
          END AS zori_data_status
        FROM standardized.zillow_zori_zip_observation
        WINDOW w AS (PARTITION BY zip_code ORDER BY reporting_month)
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.zip_month_housing_market AS
        SELECT
          coalesce(zhvi.zip_code, zori.zip_code) AS zip_code,
          coalesce(zhvi.reporting_month, zori.reporting_month) AS reporting_month,
          zhvi.zhvi,
          zori.zori,
          zhvi.zhvi / nullif(zori.zori, 0) AS price_to_monthly_rent_multiple,
          CASE
            WHEN zhvi.zhvi IS NULL OR zori.zori IS NULL THEN 'INCOMPLETE_INDEX_COVERAGE'
            ELSE 'OBSERVED_INDEX_CONTEXT'
          END AS housing_market_data_status
        FROM standardized.zillow_zhvi_zip_observation AS zhvi
        FULL OUTER JOIN standardized.zillow_zori_zip_observation AS zori
          USING (zip_code, reporting_month)
        """
    )


def build_public_safety_profile(conn: duckdb.DuckDBPyConnection) -> None:
    """Expose FBI CDE public-safety context at its reported state-month resolution."""
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.state_month_public_safety AS
        SELECT *,
          offense_rate_per_100k - lag(offense_rate_per_100k, 12) OVER w AS offense_rate_change_prior_year,
          CASE
            WHEN population_coverage_pct IS NULL THEN 'COVERAGE_NOT_REPORTED'
            WHEN population_coverage_pct < 90 THEN 'LIMITED_REPORTING_COVERAGE'
            ELSE 'OBSERVED_REPORTED_CRIME'
          END AS public_safety_data_status
        FROM standardized.fbi_cde_state_month_observation
        WINDOW w AS (PARTITION BY state_abbr, crime_category ORDER BY reporting_month)
        """
    )


def build_construction_profile(conn: duckdb.DuckDBPyConnection) -> None:
    """Expose annual county permit activity without treating permits as completed housing."""
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.county_year_construction AS
        SELECT *,
          coalesce(units_1, 0) + coalesce(units_2, 0) + coalesce(units_3_4, 0) + coalesce(units_5plus, 0) AS permitted_units_total,
          coalesce(units_2, 0) + coalesce(units_3_4, 0) + coalesce(units_5plus, 0) AS permitted_multifamily_units,
          coalesce(valuation_1, 0) + coalesce(valuation_2, 0) + coalesce(valuation_3_4, 0) + coalesce(valuation_5plus, 0) AS permitted_valuation_total,
          (coalesce(units_2, 0) + coalesce(units_3_4, 0) + coalesce(units_5plus, 0))::DOUBLE /
            nullif(coalesce(units_1, 0) + coalesce(units_2, 0) + coalesce(units_3_4, 0) + coalesce(units_5plus, 0), 0) AS multifamily_unit_share,
          (coalesce(units_1, 0) + coalesce(units_2, 0) + coalesce(units_3_4, 0) + coalesce(units_5plus, 0)) - lag(coalesce(units_1, 0) + coalesce(units_2, 0) + coalesce(units_3_4, 0) + coalesce(units_5plus, 0)) OVER w AS permitted_units_change_prior_year,
          'OBSERVED_PERMIT_AUTHORIZATION' AS construction_data_status
        FROM standardized.census_bps_county_annual_observation
        WINDOW w AS (PARTITION BY county_geoid ORDER BY reporting_year)
        """
    )


def build_private_investment_pins(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.private_investment_map_pin AS
        SELECT *,
          CASE project_status WHEN 'ANNOUNCED' THEN 0.25 WHEN 'PERMITTED' THEN 0.50
            WHEN 'UNDER_CONSTRUCTION' THEN 0.75 ELSE 0.95 END AS realization_signal
        FROM standardized.private_investment_project
        WHERE verification_status='VERIFIED'
        """
    )


def build_employment_center_accessibility(
    conn: duckdb.DuckDBPyConnection,
    reporting_year: int,
    geography_vintage: str,
    min_workplace_jobs: int,
) -> int:
    """Measure centroid distance to explicitly defined LODES workplace-job centers.

    This is proximity, not a transit or travel-time estimate. The threshold is retained
    in every row so an analyst can distinguish it from a different center definition.
    """
    definition = f"WAC_JT00_WORKPLACE_JOBS_GTE_{min_workplace_jobs}"
    rows = conn.execute(
        """
        SELECT employment.tract_geoid, geography.centroid_lon, geography.centroid_lat,
          employment.workplace_jobs, employment.source_vintage
        FROM analytics.tract_year_employment AS employment
        JOIN standardized.geography AS geography
          ON geography.geography_id = 'tract:' || employment.tract_geoid || ':' || employment.geography_vintage
        WHERE employment.reporting_year = ?
          AND employment.geography_vintage = ?
          AND geography.centroid_lon IS NOT NULL
          AND geography.centroid_lat IS NOT NULL
        """,
        [reporting_year, geography_vintage],
    ).fetchall()
    conn.execute(
        "DELETE FROM analytics.employment_center WHERE reporting_year=? AND geography_vintage=? AND center_definition=?",
        [reporting_year, geography_vintage, definition],
    )
    conn.execute(
        "DELETE FROM analytics.tract_employment_accessibility WHERE reporting_year=? AND geography_vintage=? AND center_definition=?",
        [reporting_year, geography_vintage, definition],
    )
    if not rows:
        return 0

    center_rows = [row for row in rows if row[3] >= min_workplace_jobs]
    if not center_rows:
        return 0
    built_at = datetime.now(timezone.utc).replace(tzinfo=None)
    conn.executemany(
        "INSERT INTO analytics.employment_center VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (reporting_year, tract_geoid, geography_vintage, workplace_jobs, definition, source_vintage, built_at)
            for tract_geoid, _, _, workplace_jobs, source_vintage in center_rows
        ],
    )

    def unit_vectors(input_rows: list[tuple[object, ...]]) -> np.ndarray:
        longitude = np.deg2rad(np.array([float(row[1]) for row in input_rows]))
        latitude = np.deg2rad(np.array([float(row[2]) for row in input_rows]))
        return np.column_stack((np.cos(latitude) * np.cos(longitude), np.cos(latitude) * np.sin(longitude), np.sin(latitude)))

    center_vectors = unit_vectors(center_rows)
    center_geoids = np.array([str(row[0]) for row in center_rows])
    center_jobs = np.array([float(row[3]) for row in center_rows])
    center_vintages = np.array([str(row[4]) for row in center_rows])
    output_rows: list[tuple[object, ...]] = []
    for start in range(0, len(rows), 1_024):
        tract_rows = rows[start : start + 1_024]
        closest = np.argmax(unit_vectors(tract_rows) @ center_vectors.T, axis=1)
        similarities = np.sum(unit_vectors(tract_rows) * center_vectors[closest], axis=1)
        distances_km = 6_371.0088 * np.arccos(np.clip(similarities, -1.0, 1.0))
        output_rows.extend(
            (
                reporting_year,
                str(tract_row[0]),
                geography_vintage,
                center_geoids[index],
                center_jobs[index],
                float(distances_km[position]),
                definition,
                center_vintages[index],
                built_at,
            )
            for position, (tract_row, index) in enumerate(zip(tract_rows, closest, strict=True))
        )
    conn.executemany("INSERT INTO analytics.tract_employment_accessibility VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", output_rows)
    return len(output_rows)
