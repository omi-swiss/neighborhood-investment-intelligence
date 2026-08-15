from datetime import date

from neighborhood_intelligence.qcew import QcewClient, build_observations
from neighborhood_intelligence.config import Settings


def test_qcew_url_targets_the_documented_total_industry_slice() -> None:
    assert QcewClient(Settings()).url(2025, 4) == "https://data.bls.gov/cew/data/api/2025/4/industry/10.csv"


def test_qcew_keeps_only_total_covered_counties_and_preserves_suppression() -> None:
    content = (
        'area_fips,own_code,industry_code,agglvl_code,size_code,disclosure_code,qtrly_estabs,month1_emplvl,month2_emplvl,month3_emplvl,total_qtrly_wages,avg_wkly_wage\n'
        '11001,0,10,70,0,,12,100,101,102,200000,1500\n'
        '11003,0,10,70,0,N,13,200,201,202,300000,1600\n'
        '11000,0,10,50,0,,99,999,999,999,999999,999\n'
    ).encode()

    rows = build_observations(content, 2025, 4, "run")

    assert len(rows) == 12
    assert {row[0] for row in rows} == {"11001", "11003"}
    assert all(row[8] == date(2026, 6, 2) for row in rows)
    suppressed = [row for row in rows if row[0] == "11003"]
    assert all(row[6] is None and row[7] is False for row in suppressed)
