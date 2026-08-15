from datetime import date
from pathlib import Path
from wsgiref.util import setup_testing_defaults

from neighborhood_intelligence.dashboard import dashboard_app
from neighborhood_intelligence.db import connect, migrate


def test_dashboard_exposes_only_values_known_by_the_requested_as_of_date(tmp_path: Path) -> None:
    database_path = tmp_path / "dashboard.duckdb"
    conn = connect(database_path)
    migrate(conn, Path("migrations/duckdb"))
    conn.execute(
        "INSERT INTO standardized.qcew_county_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["11001", 2025, 4, "10", "0", "covered_establishments", 10, True, date(2026, 6, 2), "2025Q4", "run"],
    )
    conn.close()
    environ = {"PATH_INFO": "/api/observations", "QUERY_STRING": "geography_type=county&geography_id=11001&as_of=2026-06-03"}
    setup_testing_defaults(environ)
    status: list[str] = []
    response = dashboard_app(database_path)(environ, lambda value, _: status.append(value))

    assert status == ["200 OK"]
    assert b'"value": 10.0' in b"".join(response)
