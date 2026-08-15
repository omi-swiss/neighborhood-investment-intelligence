from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from collections import defaultdict

import httpx
import pandas as pd
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import Settings


class LodesAssetUnavailable(RuntimeError):
    """An officially absent LODES state/year asset; retain this as a coverage gap."""


@dataclass(frozen=True)
class LodesAsset:
    asset_type: str
    url: str
    content: bytes


class LodesClient:
    """Download documented LODES 8 files without relying on a browser workflow."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _base(self, state_code: str) -> str:
        return f"{self.settings.lodes_base}/{self.settings.lodes_release}/{state_code.lower()}"

    def state_metadata_urls(self, state_code: str) -> dict[str, str]:
        base = self._base(state_code)
        state = state_code.lower()
        return {
            "version": f"{base}/version.txt",
            "checksums": f"{base}/lodes_{state}.sha256sum",
            "crosswalk": f"{base}/{state}_xwalk.csv.gz",
        }

    def data_urls(self, state_code: str, year: int, job_type: str = "JT00") -> dict[str, str]:
        base = self._base(state_code)
        state = state_code.lower()
        return {
            "rac": f"{base}/rac/{state}_rac_S000_{job_type}_{year}.csv.gz",
            "wac": f"{base}/wac/{state}_wac_S000_{job_type}_{year}.csv.gz",
            "od_main": f"{base}/od/{state}_od_main_{job_type}_{year}.csv.gz",
            "od_aux": f"{base}/od/{state}_od_aux_{job_type}_{year}.csv.gz",
        }

    @retry(
        retry=retry_if_exception_type(httpx.TransportError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=16),
        reraise=True,
    )
    def _get(self, url: str) -> bytes:
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.get(url)
        if response.status_code == 404:
            raise LodesAssetUnavailable(f"LODES asset is not published: {url}")
        response.raise_for_status()
        return response.content

    def download_asset(self, asset_type: str, url: str) -> LodesAsset:
        return LodesAsset(asset_type, url, self._get(url))

    def download_state_metadata(self, state_code: str) -> list[LodesAsset]:
        return [self.download_asset(asset_type, url) for asset_type, url in self.state_metadata_urls(state_code).items()]

    def download_state_year(self, state_code: str, year: int, job_type: str = "JT00") -> list[LodesAsset]:
        return [self.download_asset(asset_type, url) for asset_type, url in self.data_urls(state_code, year, job_type).items()]


def persist_lodes_asset(raw_dir: Path, release: str, state_code: str, year: int | None, asset: LodesAsset) -> tuple[Path, str]:
    """Preserve each unmodified LODES response beneath its release/state/year path."""
    digest = sha256(asset.content).hexdigest()
    year_segment = "metadata" if year is None else str(year)
    suffix = ".csv.gz" if asset.asset_type in {"rac", "wac", "od_main", "od_aux", "crosswalk"} else ".txt"
    target = raw_dir / "census_lodes" / release / state_code.lower() / year_segment / f"{asset.asset_type}-{digest}{suffix}"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(asset.content)
    return target, digest


def source_vintage(metadata_assets: list[LodesAsset]) -> str:
    """Create a stable release identifier from the official state version file."""
    version_asset = next((asset for asset in metadata_assets if asset.asset_type == "version"), None)
    if version_asset is None:
        return "LODES_VERSION_METADATA_UNAVAILABLE"
    return f"LODES_VERSION_SHA256:{sha256(version_asset.content).hexdigest()}"


def aggregate_block_observations(
    path: Path,
    geocode_column: str,
    chunksize: int = 250_000,
) -> list[tuple[str, float]]:
    """Aggregate a RAC or WAC S000 file from Census block to Census tract."""
    totals: defaultdict[str, float] = defaultdict(float)
    for chunk in pd.read_csv(
        path,
        compression="gzip",
        usecols=[geocode_column, "C000"],
        dtype={geocode_column: "string", "C000": "float64"},
        chunksize=chunksize,
    ):
        chunk["tract_geoid"] = chunk[geocode_column].str.slice(0, 11)
        grouped = chunk.groupby("tract_geoid", dropna=True)["C000"].sum()
        for tract_geoid, total in grouped.items():
            if len(tract_geoid) == 11 and tract_geoid.isdigit():
                totals[tract_geoid] += float(total)
    return sorted(totals.items())


def aggregate_tract_flows(path: Path, chunksize: int = 250_000) -> list[tuple[str, str, float]]:
    """Aggregate an OD file from workplace/home blocks to tract-pair flows."""
    totals: defaultdict[tuple[str, str], float] = defaultdict(float)
    for chunk in pd.read_csv(
        path,
        compression="gzip",
        usecols=["w_geocode", "h_geocode", "S000"],
        dtype={"w_geocode": "string", "h_geocode": "string", "S000": "float64"},
        chunksize=chunksize,
    ):
        chunk["workplace_tract_geoid"] = chunk["w_geocode"].str.slice(0, 11)
        chunk["residence_tract_geoid"] = chunk["h_geocode"].str.slice(0, 11)
        grouped = chunk.groupby(["workplace_tract_geoid", "residence_tract_geoid"], dropna=True)["S000"].sum()
        for (workplace, residence), total in grouped.items():
            if len(workplace) == 11 and workplace.isdigit() and len(residence) == 11 and residence.isdigit():
                totals[(workplace, residence)] += float(total)
    return [(workplace, residence, total) for (workplace, residence), total in sorted(totals.items())]


def build_observation_rows(
    path: Path,
    measure_type: str,
    reporting_year: int,
    geography_vintage: str,
    job_type: str,
    source_state: str,
    source_release: str,
    ingestion_run_id: str,
) -> list[tuple[object, ...]]:
    geocode_column = "h_geocode" if measure_type == "resident_workers" else "w_geocode"
    return [
        (tract_geoid, reporting_year, geography_vintage, measure_type, job_type, total, source_state, source_release, ingestion_run_id)
        for tract_geoid, total in aggregate_block_observations(path, geocode_column)
    ]


def build_flow_rows(
    path: Path,
    reporting_year: int,
    geography_vintage: str,
    job_type: str,
    source_state: str,
    source_release: str,
    ingestion_run_id: str,
) -> list[tuple[object, ...]]:
    return [
        (workplace, residence, reporting_year, geography_vintage, job_type, total, source_state, source_release, ingestion_run_id)
        for workplace, residence, total in aggregate_tract_flows(path)
    ]
