from pathlib import Path

import duckdb

from neighborhood_intelligence.db import migrate
from neighborhood_intelligence.phase67 import build_phase67_products
from neighborhood_intelligence.phase8_population import build_phase8_products, export_phase8_web_payload


def test_phase8_keeps_permits_in_review_queue() -> None:
    conn = duckdb.connect(":memory:")
    migrate(conn, Path("migrations/duckdb"))
    conn.execute(
        """
        INSERT INTO standardized.development_permit (
          permit_record_id, source_id, source_object_id, permit_id, jurisdiction_geoid,
          issue_date, permit_type, permit_subtype, full_address, owner_name, latitude,
          longitude, source_url, source_vintage, ingestion_run_id
        ) VALUES (
          'permit:1', 'dc_building_permits', '1', 'B1', '11001', DATE '2026-01-01',
          'CONSTRUCTION', 'NEW BUILDING', '100 TEST ST NW', 'TEST OWNER LLC', 38.9,
          -77.0, 'https://example.gov/permit/1', '2026', 'run'
        )
        """
    )
    build_phase67_products(conn)
    build_phase8_products(conn)
    assert conn.execute(
        "SELECT signal_tier FROM analytics.development_permit_map_pin"
    ).fetchone() == ("MAJOR_CANDIDATE",)
    assert conn.execute(
        "SELECT review_status FROM analytics.private_investment_review_queue"
    ).fetchone() == ("NEEDS_REVIEW",)


def test_phase8_keeps_nyc_permit_evidence_in_the_nyc_market(tmp_path: Path) -> None:
    conn = duckdb.connect(":memory:")
    migrate(conn, Path("migrations/duckdb"))
    conn.execute(
        """
        INSERT INTO standardized.development_permit (
          permit_record_id, source_id, source_object_id, permit_id, jurisdiction_geoid,
          issue_date, permit_type, permit_subtype, full_address, latitude, longitude,
          source_url, source_vintage, ingestion_run_id
        ) VALUES (
          'nyc:1', 'nyc_dob_permits', '1', 'M1', '3651000', DATE '2026-01-01',
          'NB', 'NEW BUILDING', '1 TEST AVE', 40.71, -73.99,
          'https://data.cityofnewyork.us/', '2026-01-01', 'run'
        )
        """
    )
    build_phase67_products(conn)
    build_phase8_products(conn)
    destination = tmp_path / "phase8.json"
    export_phase8_web_payload(conn, destination)
    assert '"marketId":"place:3651000"' in destination.read_text(encoding="utf-8")
