from pathlib import Path

import neighborhood_intelligence.geography as geography

from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.config import Settings
from neighborhood_intelligence.geography import (
    download_cbsa_geography,
    download_place_geography,
    download_tract_geography,
    export_display_geography_web_payload,
    persist_geographies,
    persist_geography_assignments,
)


def test_display_geography_archives_are_separate_from_analytical_reference(tmp_path: Path, monkeypatch) -> None:
    settings = Settings(raw_dir=tmp_path, reference_geography_vintage="2020", display_geography_vintage="2025")
    monkeypatch.setattr(geography, "download_tiger_archive", lambda _settings, _name, _url, destination: destination)

    assert download_tract_geography(settings, "11", "2025").parent.as_posix().endswith("2025/state=11")
    assert download_place_geography(settings, "11", "2025").parent.as_posix().endswith("2025/state=11")
    assert download_cbsa_geography(settings, "2025").parent.as_posix().endswith("2025/cbsa")


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


def test_display_geometry_export_has_no_metrics_and_preserves_both_vintages(tmp_path: Path) -> None:
    conn = connect(tmp_path / "nii.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    for vintage, geometry in (("2020", "POINT (0 0)"), ("2025", "POINT (1 1)")):
        conn.execute(
            "INSERT INTO standardized.geography VALUES (?, 'tract', '11001000100', NULL, NULL, NULL, NULL, ?, ?, 0, 0, 1, 0, 'census_tiger')",
            [f"tract:11001000100:{vintage}", vintage, geometry],
        )
    destination = tmp_path / "display-geography.json"

    assert export_display_geography_web_payload(conn, destination, "2025", "2020") == 1
    payload = __import__("json").loads(destination.read_text())
    assert payload["displayGeographyVintage"] == "2025"
    assert payload["metricGeographyVintage"] == "2020"
    assert payload["areas"] == {"11001000100": {"type": "Point", "coordinates": [1.0, 1.0]}}
    assert "metrics" not in payload
    conn.close()
