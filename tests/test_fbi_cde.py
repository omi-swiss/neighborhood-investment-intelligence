import json
from datetime import date
from pathlib import Path

from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.fbi_cde import iter_observations
from neighborhood_intelligence.transform import build_public_safety_profile


def _sample_response() -> bytes:
    return json.dumps(
        {
            "offenses": {
                "rates": {"District of Columbia Offenses": {"01-2024": 80.0}, "District of Columbia Clearances": {"01-2024": 30.0}},
                "actuals": {"District of Columbia Offenses": {"01-2024": 560}, "District of Columbia Clearances": {"01-2024": 210}},
            },
            "tooltips": {"Percent of Population Coverage": {"District of Columbia": {"01-2024": 100.0}}},
            "populations": {"population": {"District of Columbia": {"01-2024": 700000}}, "participated_population": {"District of Columbia": {"01-2024": 700000}}},
            "cde_properties": {"max_data_date": {"UCR": "07/2026"}},
        }
    ).encode()


def test_fbi_cde_parser_retains_coverage_and_state_month_resolution() -> None:
    rows = list(iter_observations(_sample_response(), "DC", "violent-crime", "run"))

    assert rows == [
        ("DC", date(2024, 1, 31), "violent-crime", 560, 210, 80.0, 30.0, 700000, 700000, 100.0, "UCR_07/2026", "run")
    ]


def test_public_safety_profile_flags_limited_reporting_coverage(tmp_path: Path) -> None:
    conn = connect(tmp_path / "public_safety.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    conn.execute(
        "INSERT INTO standardized.fbi_cde_state_month_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["DC", "2024-01-31", "violent-crime", 560, 210, 80.0, 30.0, 700000, 600000, 85.7, "v1", "run"],
    )

    build_public_safety_profile(conn)

    assert conn.execute("SELECT public_safety_data_status FROM analytics.state_month_public_safety").fetchone() == ("LIMITED_REPORTING_COVERAGE",)
    conn.close()
