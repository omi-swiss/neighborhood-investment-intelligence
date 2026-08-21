from pathlib import Path

import duckdb

from neighborhood_intelligence.db import migrate
from neighborhood_intelligence.phase8_population import build_phase8_products


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
    build_phase8_products(conn)
    assert conn.execute(
        "SELECT signal_tier FROM analytics.development_permit_map_pin"
    ).fetchone() == ("MAJOR_CANDIDATE",)
    assert conn.execute(
        "SELECT review_status FROM analytics.private_investment_review_queue"
    ).fetchone() == ("NEEDS_REVIEW",)
