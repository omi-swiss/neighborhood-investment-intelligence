from datetime import date
from pathlib import Path

from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.observations import latest_observations_as_of


def test_as_of_selection_uses_only_vintages_available_on_the_requested_date(tmp_path: Path) -> None:
    conn = connect(tmp_path / "as_of.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    conn.execute(
        "INSERT INTO standardized.qcew_county_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["11001", 2025, 4, "10", "0", "covered_establishments", 10, True, date(2026, 6, 2), "2025Q4", "run"],
    )
    conn.execute(
        "INSERT INTO standardized.estimated_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["county", "11001", "covered_establishments", date(2026, 1, 1), date(2026, 3, 31), date(2026, 5, 1), "NOWCAST", 11, 9, 13, "test-v1", "bls_qcew", "2026Q1", None],
    )

    before_observed_release = latest_observations_as_of(conn, date(2026, 5, 1), "county", ["11001"])
    after_observed_release = latest_observations_as_of(conn, date(2026, 6, 3), "county", ["11001"])

    assert before_observed_release[0][9] == 11
    assert after_observed_release[0][9] == 11
    assert after_observed_release[0][7] == "NOWCAST"
    conn.close()
