from __future__ import annotations

import calendar
import json
from dataclasses import dataclass
from datetime import date
from hashlib import sha256
from pathlib import Path
from typing import Iterator

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import Settings


class FbiCdeError(RuntimeError):
    """An FBI CDE request or schema failure safe for CLI display."""


@dataclass(frozen=True)
class FbiCdeAsset:
    state_abbr: str
    crime_category: str
    url: str
    content: bytes


class FbiCdeClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        if not settings.fbi_cde_api_key:
            raise FbiCdeError("Set FBI_CDE_API_KEY in the ignored local .env before FBI CDE ingestion.")

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=16),
        reraise=True,
    )
    def fetch_state_category(self, state_abbr: str, crime_category: str) -> FbiCdeAsset:
        start = self.settings.fbi_cde_start_month.strftime("%m-%Y")
        end = date.today().strftime("%m-%Y")
        url = (
            f"{self.settings.fbi_cde_api_base}/summarized/state/{state_abbr}/{crime_category}"
        )
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.get(
                url,
                params={"from": start, "to": end, "API_KEY": self.settings.fbi_cde_api_key},
            )
        if response.is_error:
            raise FbiCdeError(
                f"FBI CDE request failed for state={state_abbr} category={crime_category} "
                f"with HTTP {response.status_code}."
            )
        try:
            response.json()
        except json.JSONDecodeError as error:
            raise FbiCdeError("FBI CDE response was not valid JSON.") from error
        return FbiCdeAsset(state_abbr, crime_category, str(response.url), response.content)


def persist_raw(raw_dir: Path, asset: FbiCdeAsset) -> tuple[Path, str]:
    digest = sha256(asset.content).hexdigest()
    target = raw_dir / "fbi_cde" / asset.crime_category / f"{asset.state_abbr.lower()}-{digest}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(asset.content)
    return target, digest


def _state_series(container: dict[str, object], suffix: str) -> dict[str, object]:
    matches = [
        value
        for label, value in container.items()
        if label.endswith(suffix) and not label.startswith("United States") and isinstance(value, dict)
    ]
    if len(matches) != 1:
        raise FbiCdeError(f"FBI CDE response did not contain one state {suffix.strip()} series.")
    return matches[0]


def _month_end(month: str) -> date:
    try:
        month_number, year = (int(part) for part in month.split("-"))
        return date(year, month_number, calendar.monthrange(year, month_number)[1])
    except (TypeError, ValueError) as error:
        raise FbiCdeError(f"FBI CDE returned invalid reporting month {month!r}.") from error


def iter_observations(
    content: bytes, state_abbr: str, crime_category: str, run_id: str
) -> Iterator[tuple[object, ...]]:
    try:
        payload = json.loads(content)
        rates = payload["offenses"]["rates"]
        actuals = payload["offenses"]["actuals"]
        tooltips = payload["tooltips"]["Percent of Population Coverage"]
        populations = payload["populations"]
        source_month = payload["cde_properties"]["max_data_date"]["UCR"]
    except (KeyError, TypeError, json.JSONDecodeError) as error:
        raise FbiCdeError("FBI CDE response did not contain the expected summarized-crime fields.") from error
    offense_rate = _state_series(rates, " Offenses")
    clearance_rate = _state_series(rates, " Clearances")
    offense_count = _state_series(actuals, " Offenses")
    clearance_count = _state_series(actuals, " Clearances")
    coverage = _state_series(tooltips, "")
    population = _state_series(populations["population"], "")
    participating_population = _state_series(populations["participated_population"], "")
    source_vintage = f"UCR_{source_month}"
    for month, offenses in offense_count.items():
        if offenses is None:
            continue
        reporting_month = _month_end(month)
        yield (
            state_abbr.upper(),
            reporting_month,
            crime_category,
            int(offenses),
            int(clearance_count[month]) if clearance_count.get(month) is not None else None,
            float(offense_rate[month]) if offense_rate.get(month) is not None else None,
            float(clearance_rate[month]) if clearance_rate.get(month) is not None else None,
            int(population[month]) if population.get(month) is not None else None,
            int(participating_population[month]) if participating_population.get(month) is not None else None,
            float(coverage[month]) if coverage.get(month) is not None else None,
            source_vintage,
            run_id,
        )
