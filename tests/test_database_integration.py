from datetime import date
from pathlib import Path

from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.quality import record_profile_quality_results
from neighborhood_intelligence.transform import build_employment_profile, build_profile, export_profile


def test_profile_build_and_export(tmp_path: Path) -> None:
    database = tmp_path / "nii.duckdb"
    conn = connect(database)
    migrate(conn, Path("migrations/duckdb"))
    rows = []
    for year, population, income in [(2022, 100.0, 50000.0), (2023, 110.0, 55000.0)]:
        for metric, estimate in [("population", population), ("median_household_income", income)]:
            rows.append(("11001000100", year, "2020", metric, estimate, 10.0, None, None, "test", "BTEST", "BTEST_001", None, date(year - 4, 1, 1), date(year, 12, 31), date(year + 1, 1, 1), str(year), "test-run"))
    conn.executemany("INSERT INTO standardized.acs_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
    build_profile(conn, 2023)
    output = tmp_path / "tract_year_profile.parquet"
    export_profile(conn, output)
    assert conn.execute("SELECT count(*) FROM analytics.tract_year_profile").fetchone()[0] == 2
    assert conn.execute("SELECT population_change_prior_vintage FROM analytics.tract_year_trend WHERE reporting_year=2023").fetchone()[0] == 10.0
    assert conn.execute("SELECT data_completeness FROM analytics.tract_year_profile LIMIT 1").fetchone()[0] == "INCOMPLETE"
    assert conn.execute("SELECT comparability_warning FROM analytics.tract_year_trend WHERE reporting_year=2022").fetchone()[0] == "NO_PRIOR_VINTAGE"
    assert record_profile_quality_results(conn) == 2
    assert conn.execute("SELECT count(*) FROM quality.data_quality_result").fetchone()[0] == 2
    assert output.exists()
    conn.close()


def test_employment_profile_distinguishes_jobs_workers_and_flows(tmp_path: Path) -> None:
    conn = connect(tmp_path / "nii.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    observations = [
        ("11001000100", 2023, "2020", "resident_workers", "JT00", 12.0, "dc", "test", "run"),
        ("11001000100", 2023, "2020", "workplace_jobs", "JT00", 15.0, "dc", "test", "run"),
    ]
    flows = [
        ("11001000100", "11001000100", 2023, "2020", "JT00", 5.0, "dc", "test", "run"),
        ("11001000100", "11001000200", 2023, "2020", "JT00", 10.0, "dc", "test", "run"),
        ("11001000200", "11001000100", 2023, "2020", "JT00", 7.0, "dc", "test", "run"),
    ]
    conn.executemany("INSERT INTO standardized.lodes_tract_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", observations)
    conn.executemany("INSERT INTO standardized.lodes_tract_flow VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", flows)

    build_employment_profile(conn)

    assert conn.execute(
        "SELECT resident_workers, workplace_jobs, internal_jobs, worker_inflows, worker_outflows "
        "FROM analytics.tract_year_employment WHERE tract_geoid='11001000100'"
    ).fetchone() == (12.0, 15.0, 5.0, 10.0, 7.0)
    conn.close()
