from datetime import date
from pathlib import Path

import pytest

from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.transform import build_market_profile
from neighborhood_intelligence.zillow import iter_observations


def test_zori_parser_retains_zip_rows_and_requested_history(tmp_path: Path) -> None:
    source = tmp_path / "zori.csv"
    source.write_text(
        "RegionID,RegionName,RegionType,State,City,Metro,CountyName,2018-12-31,2019-01-31,2019-02-28\n"
        '1,00501,zip,NY,Holtsville,"New York, NY",Suffolk County,1000,,1020\n'
        '2,11001,city,NY,Floral Park,"New York, NY",Nassau County,2000,2010,2020\n',
        encoding="utf-8",
    )

    rows = list(iter_observations(source, date(2019, 1, 1), date(2026, 7, 1), "v1", "run"))

    assert rows == [
        ("00501", date(2019, 2, 28), 1020.0, "Holtsville", "NY", "New York, NY", "Suffolk County", date(2026, 7, 1), "v1", "run")
    ]


def test_market_profile_keeps_zori_at_zip_resolution(tmp_path: Path) -> None:
    conn = connect(tmp_path / "market.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    conn.executemany(
        "INSERT INTO standardized.zillow_zori_zip_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [("00501", date(2023, month, 28), 1000.0 + month, None, "NY", None, None, date(2026, 7, 1), "v1", "run") for month in range(1, 13)]
        + [("00501", date(2024, month, 28), 1100.0 + month, None, "NY", None, None, date(2026, 7, 1), "v1", "run") for month in range(1, 13)],
    )
    conn.executemany(
        "INSERT INTO standardized.zillow_zhvi_zip_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [("00501", date(2023, month, 28), 300000.0 + month, None, "NY", None, None, date(2026, 7, 1), "v1", "run") for month in range(1, 13)]
        + [("00501", date(2024, month, 28), 330000.0 + month, None, "NY", None, None, date(2026, 7, 1), "v1", "run") for month in range(1, 13)],
    )

    build_market_profile(conn)

    value = conn.execute(
        "SELECT zori_change_prior_year_pct, zori_data_status FROM analytics.zip_month_rent_market WHERE zip_code='00501' AND reporting_month='2024-01-28'"
    ).fetchone()
    assert value == (pytest.approx(9.9900099900), "OBSERVED_INDEX")
    housing_context = conn.execute(
        "SELECT price_to_monthly_rent_multiple, housing_market_data_status FROM analytics.zip_month_housing_market WHERE zip_code='00501' AND reporting_month='2024-01-28'"
    ).fetchone()
    assert housing_context == (pytest.approx(330001 / 1101), "OBSERVED_INDEX_CONTEXT")
    conn.close()
