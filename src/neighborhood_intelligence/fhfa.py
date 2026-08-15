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


class FhfaHpiError(RuntimeError):
    """An FHFA HPI request or schema failure safe for CLI display."""


class FhfaHpiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=16),
        reraise=True,
    )
    def fetch_tract_hpi(self) -> tuple[str, bytes, date, str]:
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.get(self.settings.fhfa_hpi_tract_url)
        if response.is_error:
            raise FhfaHpiError(f"FHFA HPI request failed with HTTP {response.status_code}.")
        publication_date = date.today()
        if last_modified := response.headers.get("last-modified"):
            publication_date = parsedate_to_datetime(last_modified).date()
        return str(response.url), response.content, publication_date, publication_date.isoformat()


def persist_raw(raw_dir: Path, content: bytes) -> tuple[Path, str]:
    digest = sha256(content).hexdigest()
    target = raw_dir / "fhfa_hpi" / "annual" / f"tract-hpi-{digest}.csv"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    return target, digest


def _number(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    return float(value)


def iter_observations(
    path: Path, publication_date: date, source_vintage: str, run_id: str
) -> Iterator[tuple[object, ...]]:
    with path.open(encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        required = {"tract", "state_abbr", "year", "annual_change", "hpi", "hpi1990", "hpi2000"}
        if not reader.fieldnames or not required.issubset(reader.fieldnames):
            raise FhfaHpiError("FHFA tract HPI CSV did not contain the documented fields.")
        for record in reader:
            tract = record.get("tract", "")
            if len(tract) != 11 or not tract.isdigit():
                continue
            hpi = _number(record.get("hpi"))
            annual_change = _number(record.get("annual_change"))
            if hpi is None and annual_change is None:
                continue
            yield (
                tract,
                int(record["year"]),
                annual_change,
                hpi,
                _number(record.get("hpi1990")),
                _number(record.get("hpi2000")),
                publication_date,
                source_vintage,
                run_id,
            )
