from __future__ import annotations

import csv
from hashlib import sha256
from pathlib import Path
from typing import Iterator

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import Settings


class BpsError(RuntimeError):
    """A Building Permits Survey request or schema failure safe for CLI display."""


class BpsClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=16),
        reraise=True,
    )
    def fetch_county_annual(self, reporting_year: int) -> tuple[str, bytes]:
        url = self.settings.bps_county_annual_url.format(year=reporting_year)
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.get(url)
        if response.is_error:
            raise BpsError(f"Census BPS county annual request failed for year={reporting_year} with HTTP {response.status_code}.")
        return str(response.url), response.content


def persist_raw(raw_dir: Path, reporting_year: int, content: bytes) -> tuple[Path, str]:
    digest = sha256(content).hexdigest()
    target = raw_dir / "census_bps" / "county_annual" / f"county-{reporting_year}-{digest}.txt"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    return target, digest


def _integer(value: str) -> int | None:
    value = value.strip()
    return int(value) if value and value not in {"-", "N", "D"} else None


def iter_county_observations(path: Path, source_vintage: str, run_id: str) -> Iterator[tuple[object, ...]]:
    """Yield annual county permits with reported columns retained separately from totals."""
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.reader(source)
        next(reader, None)
        next(reader, None)
        for record in reader:
            if len(record) < 30:
                continue
            reporting_year = _integer(record[0])
            state_fips, county_fips = record[1].strip(), record[2].strip()
            if reporting_year is None or len(state_fips) != 2 or len(county_fips) != 3:
                continue
            values = [_integer(record[index]) for index in (7, 10, 13, 16, 19, 22, 25, 28)]
            valuations = [_integer(record[index]) for index in (8, 11, 14, 17)]
            yield (
                state_fips + county_fips,
                reporting_year,
                record[5].strip() or None,
                *values[:4],
                *valuations,
                *values[4:],
                source_vintage,
                run_id,
            )
