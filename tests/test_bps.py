from pathlib import Path

from neighborhood_intelligence.bps import iter_county_observations
from neighborhood_intelligence.db import connect, migrate
from neighborhood_intelligence.transform import build_construction_profile


def test_bps_parser_retains_county_authorizations_and_reported_units(tmp_path: Path) -> None:
    source = tmp_path / "county.txt"
    source.write_text(
        "header\nheader\n2025,01,001,3,6,Autauga County,2,2,100,1,2,200,1,4,300,1,8,400,1,1,50,1,2,150,1,4,250,1,8,350\n",
        encoding="utf-8",
    )

    rows = list(iter_county_observations(source, "BPS_2025", "run"))

    assert rows == [("01001", 2025, "Autauga County", 2, 2, 4, 8, 100, 200, 300, 400, 1, 2, 4, 8, "BPS_2025", "run")]


def test_construction_profile_labels_permit_authorizations(tmp_path: Path) -> None:
    conn = connect(tmp_path / "construction.duckdb")
    migrate(conn, Path("migrations/duckdb"))
    conn.execute(
        "INSERT INTO standardized.census_bps_county_annual_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["01001", 2025, "Autauga County", 2, 2, 4, 8, 100, 200, 300, 400, 1, 2, 4, 8, "BPS_2025", "run"],
    )

    build_construction_profile(conn)

    assert conn.execute("SELECT permitted_units_total, permitted_multifamily_units, permitted_valuation_total, construction_data_status FROM analytics.county_year_construction").fetchone() == (16, 14, 1000, "OBSERVED_PERMIT_AUTHORIZATION")
    conn.close()
