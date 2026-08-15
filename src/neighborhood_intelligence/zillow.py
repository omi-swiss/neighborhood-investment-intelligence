from __future__ import annotations

import csv
from datetime import date
from email.utils import parsedate_to_datetime
from hashlib import sha256
from pathlib import Path
from typing import Iterator

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import Settings


class ZillowZoriError(RuntimeError):
    """A Zillow ZORI request or schema failure safe for CLI display."""


class ZillowZoriClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=16),
        reraise=True,
    )
    def fetch_zip_zori(self) -> tuple[str, bytes, date, str]:
        return self._fetch(self.settings.zillow_zori_zip_url, "ZORI")

    def _fetch(self, url: str, series_name: str) -> tuple[str, bytes, date, str]:
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.get(url)
        if response.is_error:
            raise ZillowZoriError(f"Zillow {series_name} request failed with HTTP {response.status_code}.")
        publication_date = date.today()
        if last_modified := response.headers.get("last-modified"):
            publication_date = parsedate_to_datetime(last_modified).date()
        return str(response.url), response.content, publication_date, publication_date.isoformat()


class ZillowZhviClient(ZillowZoriClient):
    def fetch_zip_zhvi(self) -> tuple[str, bytes, date, str]:
        return self._fetch(self.settings.zillow_zhvi_zip_url, "ZHVI")


def _persist_raw(raw_dir: Path, series: str, content: bytes) -> tuple[Path, str]:
    digest = sha256(content).hexdigest()
    target = raw_dir / f"zillow_{series}" / "monthly" / f"zip-{series}-{digest}.csv"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    return target, digest


def persist_raw(raw_dir: Path, content: bytes) -> tuple[Path, str]:
    return _persist_raw(raw_dir, "zori", content)


def persist_zhvi_raw(raw_dir: Path, content: bytes) -> tuple[Path, str]:
    return _persist_raw(raw_dir, "zhvi", content)


def iter_observations(
    path: Path, start_date: date, publication_date: date, source_vintage: str, run_id: str
) -> Iterator[tuple[object, ...]]:
    """Yield ZIP-native ZORI rows from Zillow's wide monthly public CSV."""
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        required = {"RegionName", "RegionType", "State", "City", "Metro", "CountyName"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise ZillowZoriError("Zillow ZORI CSV did not contain the documented ZIP metadata fields.")
        monthly_fields: list[tuple[str, date]] = []
        for field in reader.fieldnames:
            try:
                monthly_fields.append((field, date.fromisoformat(field)))
            except ValueError:
                continue
        if not monthly_fields:
            raise ZillowZoriError("Zillow ZORI CSV did not contain ISO monthly columns.")
        for record in reader:
            zip_code = record.get("RegionName", "")
            if record.get("RegionType", "").lower() != "zip" or len(zip_code) != 5 or not zip_code.isdigit():
                continue
            for field, reporting_month in monthly_fields:
                raw_value = record.get(field)
                if reporting_month < start_date or raw_value in (None, ""):
                    continue
                yield (
                    zip_code,
                    reporting_month,
                    float(raw_value),
                    record.get("City") or None,
                    record.get("State") or None,
                    record.get("Metro") or None,
                    record.get("CountyName") or None,
                    publication_date,
                    source_vintage,
                    run_id,
                )
