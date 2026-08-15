from __future__ import annotations

from datetime import date, datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
from uuid import uuid4

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .catalog import METRICS
from .config import Settings


class CensusApiError(RuntimeError):
    """A Census API failure that is safe to display in logs and CLI errors."""


class CensusAcsClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _url(self, year: int) -> str:
        return f"{self.settings.acs_api_base}/{year}/acs/acs5"

    @retry(retry=retry_if_exception_type(httpx.HTTPError), stop=stop_after_attempt(4), wait=wait_exponential(min=1, max=16), reraise=True)
    def get_json(self, url: str, params: dict[str, str]) -> object:
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.get(url, params=params)
            if response.is_redirect and response.headers.get("location", "").endswith("invalid_key.html"):
                raise CensusApiError("Census API rejected the configured API key.")
            if response.is_error or response.is_redirect:
                raise CensusApiError(f"Census API request failed with HTTP {response.status_code}.")
            return response.json()

    def verify_variables(self, year: int) -> None:
        metadata = self.get_json(f"{self._url(year)}/groups/B01003.json", {})
        if not isinstance(metadata, dict) or "variables" not in metadata:
            raise ValueError(f"Unexpected ACS metadata response for {year}")
        # Full verification happens by requesting all selected variables; a missing one returns a Census error.

    def fetch_state_tracts(self, year: int, state_fips: str) -> tuple[list[dict[str, str]], str, bytes]:
        variables = [f"{metric.variable}{suffix}" for metric in METRICS for suffix in ("E", "M")]
        params = {"get": "NAME," + ",".join(variables), "for": "tract:*", "in": f"state:{state_fips} county:*"}
        if self.settings.census_api_key:
            params["key"] = self.settings.census_api_key
        payload = self.get_json(self._url(year), params)
        raw = json.dumps(payload, separators=(",", ":"), sort_keys=False).encode()
        if not isinstance(payload, list) or len(payload) < 2:
            raise ValueError(f"ACS response has no records for {year} state {state_fips}")
        header = payload[0]
        records = [dict(zip(header, row, strict=True)) for row in payload[1:]]
        lineage_params = {name: value for name, value in params.items() if name != "key"}
        request_url = str(httpx.URL(self._url(year), params=lineage_params))
        return records, request_url, raw


def parse_number(value: str | None) -> float | None:
    if value in (None, "", "-666666666"):
        return None
    return float(value)


def geography_vintage(year: int) -> str:
    return "2010" if year <= 2019 else "2020"


def observation_window(year: int) -> tuple[date, date]:
    return date(year - 4, 1, 1), date(year, 12, 31)


def persist_raw(raw_dir: Path, year: int, state: str, content: bytes) -> tuple[Path, str]:
    digest = sha256(content).hexdigest()
    target = raw_dir / "census_acs5" / str(year) / f"state={state}" / f"tracts-{digest}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    return target, digest


def build_observations(records: list[dict[str, str]], year: int, run_id: str) -> list[tuple[object, ...]]:
    start, end = observation_window(year)
    today = date.today()
    rows: list[tuple[object, ...]] = []
    for record in records:
        geoid = f"{record['state']}{record['county']}{record['tract']}"
        for metric in METRICS:
            rows.append((geoid, year, geography_vintage(year), metric.metric_id, parse_number(record.get(metric.variable + "E")), parse_number(record.get(metric.variable + "M")), None, None, metric.universe, metric.table, metric.variable, metric.formula, start, end, today, str(year), run_id))
    return rows


def new_run_id() -> str:
    return str(uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)
