from __future__ import annotations

import csv
from collections import defaultdict
from hashlib import sha256
from pathlib import Path

import httpx

from .config import Settings


class NbiClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def fetch_state(self, state_abbr: str) -> tuple[str, bytes]:
        url = self.settings.nbi_delimited_url.format(
            state=state_abbr.upper(), year=self.settings.nbi_year, year_short=self.settings.nbi_year % 100
        )
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.get(url)
        response.raise_for_status()
        return str(response.url), response.content


def persist_raw(raw_dir: Path, state_abbr: str, year: int, content: bytes) -> tuple[Path, str]:
    digest = sha256(content).hexdigest()
    target = raw_dir / "fhwa_nbi" / str(year) / f"{state_abbr.lower()}-{digest}.csv"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    return target, digest


def county_rows(path: Path, reporting_year: int, run_id: str):
    totals: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    with path.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source, quotechar="'"):
            state, county = row.get("STATE_CODE_001", ""), row.get("COUNTY_CODE_003", "")
            if len(state) != 2 or len(county) != 3 or not state.isdigit() or not county.isdigit():
                continue
            values = totals[state + county]
            values["bridge_count"] += 1
            condition = row.get("BRIDGE_CONDITION", "").strip()
            if condition in {"G", "F", "P"}:
                values[f"{condition}_count"] += 1
            try:
                values["deck_area"] += float(row.get("DECK_AREA", "") or 0)
            except ValueError:
                pass
    for county_geoid, values in totals.items():
        yield (county_geoid, reporting_year, int(values["bridge_count"]), int(values["G_count"]), int(values["F_count"]), int(values["P_count"]), values["deck_area"], run_id)
