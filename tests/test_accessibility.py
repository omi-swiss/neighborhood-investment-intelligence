from pathlib import Path

from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.transform import build_employment_center_accessibility, build_employment_profile


def test_employment_accessibility_uses_an_explicit_workplace_job_center_threshold(tmp_path: Path) -> None:
    conn = connect(tmp_path / "accessibility.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    geographies = [
        ("tract:00000000001:2020", "tract", "00000000001", None, None, None, None, "2020", None, 0.0, 0.0, None, None, "census_tiger"),
        ("tract:00000000002:2020", "tract", "00000000002", None, None, None, None, "2020", None, 0.1, 0.0, None, None, "census_tiger"),
        ("tract:00000000003:2020", "tract", "00000000003", None, None, None, None, "2020", None, 10.0, 0.0, None, None, "census_tiger"),
    ]
    conn.executemany("INSERT INTO standardized.geography VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", geographies)
    observations = [
        ("00000000001", 2023, "2020", "workplace_jobs", "JT00", 6000, "aa", "LODES8", "run"),
        ("00000000002", 2023, "2020", "workplace_jobs", "JT00", 1000, "aa", "LODES8", "run"),
        ("00000000003", 2023, "2020", "workplace_jobs", "JT00", 7000, "aa", "LODES8", "run"),
    ]
    conn.executemany("INSERT INTO standardized.lodes_tract_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", observations)

    build_employment_profile(conn)
    row_count = build_employment_center_accessibility(conn, 2023, "2020", 5000)
    nearest_center = conn.execute(
        "SELECT nearest_center_tract_geoid FROM analytics.tract_employment_accessibility WHERE tract_geoid='00000000002'"
    ).fetchone()

    assert row_count == 3
    assert conn.execute("SELECT count(*) FROM analytics.employment_center").fetchone() == (2,)
    assert nearest_center == ("00000000001",)
    conn.close()
