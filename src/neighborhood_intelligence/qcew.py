from __future__ import annotations

import csv
from datetime import date
from hashlib import sha256
from io import StringIO
from pathlib import Path

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import Settings


QCEW_TOTAL_COVERED = {"industry_code": "10", "own_code": "0", "agglvl_code": "70", "size_code": "0"}
QCEW_MEASURES = {
    "qtrly_estabs": "covered_establishments",
    "month1_emplvl": "covered_employment_month1",
    "month2_emplvl": "covered_employment_month2",
    "month3_emplvl": "covered_employment_month3",
    "total_qtrly_wages": "total_quarterly_wages",
    "avg_wkly_wage": "average_weekly_wage",
}


class QcewError(RuntimeError):
    """A QCEW request or schema failure safe for CLI display."""


class QcewClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def url(self, year: int, quarter: int) -> str:
        if quarter not in range(1, 5):
            raise ValueError("QCEW quarter must be from 1 through 4")
        return f"{self.settings.qcew_api_base}/{year}/{quarter}/industry/10.csv"

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=16),
        reraise=True,
    )
    def fetch_total_covered_counties(self, year: int, quarter: int) -> tuple[str, bytes]:
        url = self.url(year, quarter)
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.get(url)
        if response.is_error:
            raise QcewError(f"QCEW request failed with HTTP {response.status_code}.")
        return url, response.content


def persist_raw(raw_dir: Path, year: int, quarter: int, content: bytes) -> tuple[Path, str]:
    digest = sha256(content).hexdigest()
    target = raw_dir / "bls_qcew" / str(year) / f"quarter={quarter}" / f"total-covered-{digest}.csv"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    return target, digest


def publication_date(year: int, quarter: int) -> date:
    """Known BLS release dates; unknown future quarters are intentionally ingest-dated."""
    known_dates = {(2025, 4): date(2026, 6, 2)}
    return known_dates.get((year, quarter), date.today())


def _parse_number(value: str | None) -> float | None:
    if value in (None, "", "N"):
        return None
    return float(value)


def build_observations(content: bytes, year: int, quarter: int, run_id: str) -> list[tuple[object, ...]]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise QcewError("QCEW response was not UTF-8 CSV.") from error
    reader = csv.DictReader(StringIO(text))
    if not reader.fieldnames or not set(QCEW_TOTAL_COVERED).issubset(reader.fieldnames):
        raise QcewError("QCEW CSV did not contain the documented county total-covered fields.")

    rows: list[tuple[object, ...]] = []
    release_date = publication_date(year, quarter)
    for record in reader:
        if any(record.get(field) != expected for field, expected in QCEW_TOTAL_COVERED.items()):
            continue
        county_fips = record.get("area_fips", "")
        if len(county_fips) != 5 or not county_fips.isdigit():
            continue
        disclosed = record.get("disclosure_code", "") != "N"
        for source_field, measure_type in QCEW_MEASURES.items():
            rows.append(
                (
                    county_fips,
                    year,
                    quarter,
                    "10",
                    "0",
                    measure_type,
                    _parse_number(record.get(source_field)) if disclosed else None,
                    disclosed,
                    release_date,
                    f"{year}Q{quarter}",
                    run_id,
                )
            )
    if not rows:
        raise QcewError("QCEW CSV contained no county total-covered rows.")
    return rows
