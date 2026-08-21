from pathlib import Path

from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.geography import persist_geographies, persist_geography_assignments


def test_persist_geographies_uses_the_stable_geography_id(tmp_path: Path) -> None:
    conn = connect(tmp_path / "nii.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    row = (
        "tract:11001000100:2020", "tract", "11001000100", "Census Tract 1", None,
        None, None, "2020", "POINT (0 0)", 0.0, 0.0, 1, 0, "census_tiger",
    )

    assert persist_geographies(conn, [row]) == 1
    assert persist_geographies(conn, [(*row[:3], "Updated tract", *row[4:])]) == 1
    assert conn.execute("SELECT name FROM standardized.geography").fetchone()[0] == "Updated tract"
    conn.close()


def test_persist_geography_assignments_retains_method_and_confidence(tmp_path: Path) -> None:
    conn = connect(tmp_path / "nii.duckdb")
    migrate(conn, Path("migrations/duckdb"))

    count = persist_geography_assignments(
        conn,
        [("tract:11001000100:2020", "place:1150000:2020")],
        "place",
        "2020",
    )

    assert count == 1
    assert conn.execute(
        "SELECT assignment_method, confidence FROM standardized.geography_assignment"
    ).fetchone() == ("TRACT_CENTROID_WITHIN", "HIGH")
    conn.close()
