from pathlib import Path

import duckdb
import pytest

from neighborhood_intelligence.db import migrate
from neighborhood_intelligence.phase67 import (
    build_phase67_products,
    iter_environmental_risks,
    iter_public_projects,
    iter_regulatory_policies,
)
from neighborhood_intelligence.private_projects import iter_projects


def test_phase67_templates_parse() -> None:
    templates = Path("templates")
    assert len(list(iter_public_projects(templates / "public_investment_projects.csv", "run"))) == 1
    assert len(list(iter_projects(templates / "private_investment_projects_v2.csv", "run"))) == 1
    assert len(list(iter_regulatory_policies(templates / "regulatory_policies.csv", "run"))) == 1
    assert len(
        list(iter_environmental_risks(templates / "environmental_risk_observations.csv", "run"))
    ) == 1


def test_phase67_products_separate_announced_and_committed() -> None:
    conn = duckdb.connect(":memory:")
    migrate(conn, Path("migrations/duckdb"))
    conn.execute(
        """
        INSERT INTO standardized.public_investment_project (
          project_id, project_name, sponsor_name, project_type, project_status, funding_status,
          total_project_cost_usd, appropriated_funding_usd, geography_type, geography_id,
          county_geoid, latitude, longitude, coordinate_precision, primary_source_url,
          last_verified_date, verification_status, confidence_level, ingestion_run_id
        ) VALUES ('public', 'Station', 'Transit agency', 'TRANSIT', 'APPROVED',
          'APPROPRIATED', 100, 100, 'POINT', 'public', '11001', 38.9, -77.0,
          'EXACT', 'https://example.gov/public', DATE '2026-01-01', 'VERIFIED', 'HIGH', 'run')
        """
    )
    conn.execute(
        """
        INSERT INTO standardized.private_investment_project (
          project_id, company_name, investment_type, project_status, capex_usd, county_geoid,
          latitude, longitude, coordinate_precision, primary_source_url, verification_status,
          ingestion_run_id, evidence_type, funding_status, last_verified_date, confidence_level
        ) VALUES ('private', 'Company', 'OFFICE', 'ANNOUNCED', 50, '11001', 38.8, -77.1,
          'EXACT', 'https://example.com/private', 'VERIFIED', 'run',
          'OFFICIAL_COMPANY_DISCLOSURE', 'ANNOUNCED', DATE '2026-01-01', 'MEDIUM')
        """
    )
    build_phase67_products(conn)
    summary = conn.execute(
        """
        SELECT announced_pipeline_usd, committed_pipeline_usd, committed_project_count
        FROM analytics.county_investment_summary WHERE county_geoid = '11001'
        """
    ).fetchone()
    assert summary == pytest.approx((150, 100, 1))


def test_private_investment_centroids_do_not_publish_as_map_pins() -> None:
    conn = duckdb.connect(":memory:")
    migrate(conn, Path("migrations/duckdb"))
    conn.execute(
        """
        INSERT INTO standardized.private_investment_project (
          project_id, company_name, investment_type, project_status, county_geoid,
          latitude, longitude, coordinate_precision, primary_source_url, verification_status,
          ingestion_run_id, evidence_type, funding_status, last_verified_date, confidence_level
        ) VALUES ('centroid', 'Company', 'OFFICE', 'ANNOUNCED', '11001', 38.9, -77.0,
          'COUNTY_CENTROID', 'https://example.com/project', 'VERIFIED', 'run',
          'OFFICIAL_COMPANY_DISCLOSURE', 'ANNOUNCED', DATE '2026-01-01', 'MEDIUM')
        """
    )
    build_phase67_products(conn)
    assert conn.execute("SELECT count(*) FROM analytics.private_investment_map_pin").fetchone() == (0,)
