from __future__ import annotations

from pathlib import Path
import duckdb

from .catalog import METRICS


# Annual CPI-U values; fixed, documented values for Phase 1 and replaced through a versioned BLS source ingestion later.
CPI_U = {2019: 255.657, 2020: 258.811, 2021: 270.970, 2022: 292.655, 2023: 304.702, 2024: 313.689}


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
    conn.execute("""
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
        max(CASE WHEN metric_id='poverty_population_below' THEN estimate END) / nullif(max(CASE WHEN metric_id='poverty_population' THEN estimate END),0) AS poverty_rate,
        max(CASE WHEN metric_id='civilian_labor_force' THEN estimate END) AS civilian_labor_force,
        max(CASE WHEN metric_id='employed' THEN estimate END) AS employed_residents,
        max(CASE WHEN metric_id='unemployed' THEN estimate END) / nullif(max(CASE WHEN metric_id='civilian_labor_force' THEN estimate END),0) AS unemployment_rate,
        max(CASE WHEN metric_id='housing_units' THEN estimate END) AS housing_units,
        max(CASE WHEN metric_id='occupied_housing_units' THEN estimate END) AS occupied_housing_units,
        max(CASE WHEN metric_id='vacant_housing_units' THEN estimate END) / nullif(max(CASE WHEN metric_id='housing_units' THEN estimate END),0) AS vacancy_rate,
        max(CASE WHEN metric_id='renter_occupied_units' THEN estimate END) / nullif(max(CASE WHEN metric_id='occupied_housing_units' THEN estimate END),0) AS renter_share,
        max(CASE WHEN metric_id='owner_occupied_units' THEN estimate END) / nullif(max(CASE WHEN metric_id='occupied_housing_units' THEN estimate END),0) AS owner_share,
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
    """, [
        len(METRICS), len(METRICS), unreliable_relative_moe, caution_relative_moe,
        unreliable_relative_moe, caution_relative_moe,
    ])
    for year, cpi in CPI_U.items():
        conn.execute("""
          UPDATE analytics.tract_year_profile
          SET median_household_income_real = median_household_income * ? / ?,
              per_capita_income_real = per_capita_income * ? / ?,
              median_gross_rent_real = median_gross_rent * ? / ?,
              median_home_value_real = median_home_value * ? / ?
          WHERE reporting_year = ?
        """, [CPI_U[reference_year], cpi, CPI_U[reference_year], cpi, CPI_U[reference_year], cpi, CPI_U[reference_year], cpi, year])
    conn.execute("""
      CREATE OR REPLACE TABLE analytics.tract_year_trend AS
      SELECT *,
        population - lag(population) OVER w AS population_change_prior_vintage,
        median_household_income_real - lag(median_household_income_real) OVER w AS real_income_change_prior_vintage,
        CASE WHEN lag(geography_vintage) OVER w IS NULL THEN 'NO_PRIOR_VINTAGE'
             WHEN geography_vintage <> lag(geography_vintage) OVER w THEN 'GEOGRAPHY_NORMALIZATION_REQUIRED'
             ELSE 'ACS_WINDOWS_OVERLAP' END AS comparability_warning
      FROM analytics.tract_year_profile
      WINDOW w AS (PARTITION BY tract_geoid ORDER BY reporting_year)
    """)


def export_profile(conn: duckdb.DuckDBPyConnection, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    escaped = str(destination).replace("'", "''")
    conn.execute(f"COPY analytics.tract_year_trend TO '{escaped}' (FORMAT PARQUET, COMPRESSION ZSTD)")


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
