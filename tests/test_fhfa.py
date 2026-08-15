from datetime import date
from pathlib import Path

from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.fhfa import iter_observations
from neighborhood_intelligence.transform import build_market_profile


def test_fhfa_tract_hpi_parser_skips_empty_unpublished_rows(tmp_path: Path) -> None:
    source = tmp_path / "hpi.csv"
    source.write_text(
        "tract,state_abbr,year,annual_change,hpi,hpi1990,hpi2000\n"
        "11001000100,DC,2024,3.2,250.0,240.0,180.0\n"
        "11001000100,DC,2025,,,,\n",
        encoding="utf-8",
    )

    rows = list(iter_observations(source, date(2026, 7, 1), "2026-07-01", "run"))

    assert rows == [("11001000100", 2024, 3.2, 250.0, 240.0, 180.0, date(2026, 7, 1), "2026-07-01", "run")]


def test_market_profile_retains_an_index_as_an_index(tmp_path: Path) -> None:
    conn = connect(tmp_path / "market.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    conn.executemany(
        "INSERT INTO standardized.fhfa_hpi_tract_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            ("11001000100", 2023, 5.0, 100.0, None, 100.0, date(2024, 1, 1), "v1", "run"),
            ("11001000100", 2024, 3.0, 103.0, None, 103.0, date(2025, 1, 1), "v2", "run"),
        ],
    )

    build_market_profile(conn)

    assert conn.execute("SELECT hpi_change_prior_year, hpi_data_status FROM analytics.tract_year_market WHERE reporting_year=2024").fetchone() == (3.0, "OBSERVED_INDEX")
    conn.close()
