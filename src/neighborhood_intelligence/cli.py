from __future__ import annotations

import json
from hashlib import sha256
from datetime import date
from pathlib import Path
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import subprocess
import sys
try:
    from itertools import batched
except ImportError:  # Python 3.11 compatibility; itertools.batched arrived in 3.12.
    from itertools import islice

    def batched(iterable, size):
        iterator = iter(iterable)
        while batch := tuple(islice(iterator, size)):
            yield batch
from uuid import uuid4

import typer

from .acs import CensusAcsClient, build_observations, new_run_id, now_utc, persist_observations, persist_raw
from .bps import BpsClient, iter_county_observations, persist_raw as persist_bps_raw
from .catalog import OFFICIAL_SOURCES, PHASE8_OFFICIAL_SOURCES
from .config import load_settings
from .dashboard import serve_dashboard
from .db import connect, migrate
from .fhfa import FhfaHpiClient, iter_observations as iter_fhfa_observations, persist_raw as persist_fhfa_raw
from .fbi_cde import FbiCdeClient, iter_observations as iter_fbi_cde_observations, persist_raw as persist_fbi_cde_raw
from .geography import (
    assign_tract_context,
    download_cbsa_geography,
    download_place_geography,
    download_tract_geography,
    export_display_geography_web_payload,
    load_cbsa_geography,
    load_place_geography,
    load_tract_geography,
)
from .lodes import (
    LodesAssetUnavailable,
    LodesClient,
    build_flow_rows,
    build_observation_rows,
    persist_lodes_asset,
    source_vintage,
)
from .nbi import NbiClient, county_rows as nbi_county_rows, persist_raw as persist_nbi_raw
from .phase67 import (
    build_phase67_products,
    export_phase67,
    ingest_evidence_csv,
    iter_environmental_risks,
    iter_public_projects,
    iter_regulatory_policies,
)
from .phase8_population import (
    build_phase8_products,
    export_phase8,
    export_phase8_web_payload,
    ingest_dc_building_permits,
    ingest_epa_frs,
    ingest_fema_flood_dc,
)
from .remaining_gaps import (
    build_remaining_gap_products,
    export_remaining_gaps,
    export_remaining_gaps_web_payload,
    ingest_baltimore_property_records,
    ingest_dc_cama_residential,
    ingest_dc_property_assessments,
    ingest_philadelphia_property_records,
    ingest_usaspending_dc,
    load_market_rollout,
)
from .private_projects import iter_projects
from .quality import record_profile_quality_results
from .qcew import QcewClient, build_observations as build_qcew_observations, persist_raw as persist_qcew_raw
from .transform import build_construction_profile, build_employment_center_accessibility, build_employment_profile, build_market_profile, build_private_investment_pins, build_profile, build_public_safety_profile, export_powerbi_county_overview, export_powerbi_tract_overview, export_private_investment_pins, export_profile, export_tableau_county_overview, export_tableau_tract_boundaries, export_tableau_tract_map
from .zillow import (
    ZillowZhviClient,
    ZillowZoriClient,
    iter_observations as iter_zori_observations,
    persist_raw as persist_zori_raw,
    persist_zhvi_raw,
)

app = typer.Typer(
    no_args_is_help=True,
    add_completion=False,
    # Settings may hold API credentials; never render local variables in errors.
    pretty_exceptions_show_locals=False,
)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)


def database():
    settings = load_settings()
    conn = connect(settings.database_path)
    migrate(conn, Path("migrations/duckdb"))
    return settings, conn


@app.command()
def init() -> None:
    """Create or migrate the local analytical database."""
    settings, conn = database()
    conn.close()
    typer.echo(f"Initialized {settings.database_path}")


@app.command("register-sources")
def register_sources() -> None:
    """Register reviewed official source metadata."""
    _, conn = database()
    sources = OFFICIAL_SOURCES + PHASE8_OFFICIAL_SOURCES
    for row in sources:
        conn.execute("INSERT OR REPLACE INTO meta.source_catalog VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)", row)
    conn.close()
    typer.echo(f"Registered {len(sources)} sources")


def _completed_acs_units(conn, states: list[str], years: list[int]) -> set[tuple[int, str]]:
    """Return state-years with a successful run and observations, for safe resume only."""
    if not states or not years:
        return set()
    rows = conn.execute(
        """
        WITH latest_runs AS (
          SELECT
            cast(json_extract_string(request_parameters, '$.year') AS INTEGER) AS reporting_year,
            json_extract_string(request_parameters, '$.state') AS state_fips,
            status,
            row_number() OVER (
              PARTITION BY json_extract_string(request_parameters, '$.year'),
                json_extract_string(request_parameters, '$.state')
              ORDER BY started_at DESC
            ) AS latest
          FROM meta.ingestion_run
          WHERE source_id = 'census_acs5'
        )
        SELECT reporting_year, state_fips
        FROM latest_runs
        WHERE latest = 1 AND status = 'SUCCEEDED'
          AND reporting_year IN (SELECT unnest(?))
          AND state_fips IN (SELECT unnest(?))
          AND EXISTS (
            SELECT 1
            FROM standardized.acs_observation AS observation
            WHERE observation.reporting_year = latest_runs.reporting_year
              AND observation.tract_geoid LIKE latest_runs.state_fips || '%'
          )
        """,
        [years, states],
    ).fetchall()
    return {(int(year), str(state)) for year, state in rows}


def _write_acs_unit(conn, settings, year: int, state: str, run_id: str, payload) -> int:
    records, request_url, raw = payload
    asset_path, digest = persist_raw(settings.raw_dir, year, state, raw)
    rows = build_observations(records, year, run_id)
    conn.execute("BEGIN TRANSACTION")
    try:
        persist_observations(conn, rows)
        conn.execute(
            "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [str(uuid4()), run_id, request_url, now_utc(), str(asset_path), digest, len(raw), "acs-api-json-v1", "See source catalog"],
        )
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', record_count=?, checksum_sha256=? WHERE run_id=?",
            [now_utc(), len(records), digest, run_id],
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    return len(records)


@app.command("ingest-acs")
def ingest_acs(
    state: list[str] = typer.Option(None, "--state"),
    year: list[int] = typer.Option(None, "--year"),
    fetch_workers: int = typer.Option(3, "--fetch-workers", min=1, max=8),
    resume: bool = typer.Option(False, "--resume"),
) -> None:
    """Ingest ACS 5-year tract observations for selected states and vintages."""
    settings, conn = database()
    states, years = state or settings.states, year or settings.acs_years
    completed = _completed_acs_units(conn, states, years) if resume else set()
    units = [(current_year, state_fips) for current_year in years for state_fips in states]
    units = [unit for unit in units if unit not in completed]
    if not units:
        conn.close()
        typer.echo("ACS ingestion already complete for requested state-years")
        return
    with CensusAcsClient(settings) as client:
        for current_year in sorted(set(year for year, _ in units)):
            client.verify_variables(current_year)
        failures: list[str] = []
        with ThreadPoolExecutor(max_workers=fetch_workers) as executor:
            futures = {
                executor.submit(client.fetch_state_tracts, current_year, state_fips): (current_year, state_fips)
                for current_year, state_fips in units
            }
            for future in as_completed(futures):
                current_year, state_fips = futures[future]
                run_id = new_run_id()
                conn.execute("INSERT INTO meta.ingestion_run VALUES (?, 'census_acs5', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)", [run_id, now_utc(), f'{{"year": {current_year}, "state": "{state_fips}"}}'])
                try:
                    record_count = _write_acs_unit(conn, settings, current_year, state_fips, run_id, future.result())
                    logger.info("ingested year=%s state=%s records=%s", current_year, state_fips, record_count)
                except Exception as error:
                    conn.execute("UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?", [now_utc(), str(error), run_id])
                    logger.exception("ingestion failed year=%s state=%s", current_year, state_fips)
                    failures.append(f"{current_year}/{state_fips}")
    conn.close()
    if failures:
        raise RuntimeError("ACS ingestion failed for state-years: " + ", ".join(failures))


@app.command("refresh-opportunity-cohort")
def refresh_opportunity_cohort(
    fetch_workers: int = typer.Option(3, "--fetch-workers", min=1, max=8),
    resume: bool = typer.Option(False, "--resume"),
) -> None:
    """Refresh the configured ACS cohort without publishing a partial release."""
    settings = load_settings()
    if not settings.opportunity_cohort_states:
        raise typer.BadParameter("Configure opportunity_cohort_states before refreshing the cohort")
    years = [year for year in settings.acs_years if year >= 2020]
    ingest_acs(
        state=settings.opportunity_cohort_states,
        year=years,
        fetch_workers=fetch_workers,
        resume=resume,
    )


def _artifact_metadata(path: Path) -> dict[str, object]:
    content = path.read_bytes()
    return {"path": str(path), "byteCount": len(content), "sha256": sha256(content).hexdigest()}


@app.command("release-opportunity-cohort")
def release_opportunity_cohort(
    fetch_workers: int = typer.Option(3, "--fetch-workers", min=1, max=8),
    resume: bool = typer.Option(False, "--resume"),
) -> None:
    """Build a manifest-backed local opportunity release; it never deploys."""
    settings, conn = database()
    states = settings.opportunity_cohort_states
    years = [year for year in settings.acs_years if year >= 2020]
    if not states or not settings.opportunity_cohort_city_geoids:
        conn.close()
        raise typer.BadParameter("Configure the opportunity cohort states and city GEOIDs before release")
    release_id = str(uuid4())
    started_at = now_utc()
    conn.execute(
        "INSERT INTO meta.opportunity_release_manifest VALUES (?, ?, NULL, 'RUNNING', ?, ?, ?, ?, NULL, NULL, NULL, NULL)",
        [release_id, started_at, json.dumps(states), json.dumps(years), settings.reference_geography_vintage, settings.display_geography_vintage],
    )
    conn.close()
    try:
        refresh_opportunity_cohort(fetch_workers=fetch_workers, resume=resume)
        ingest_geography(state=states)
        ingest_display_geography(state=states)
        build_profile_command()
        export_profile_command()
        export_display_geography_web_command(
            destination=Path("web/app/data/display-geography.generated.json"),
            all_loaded_tracts=False,
        )
        subprocess.run([sys.executable, "scripts/export_web_phase1.py"], check=True)

        _, conn = database()
        runs = conn.execute(
            """
            SELECT run_id FROM (
              SELECT run_id, row_number() OVER (
                PARTITION BY json_extract_string(request_parameters, '$.year'),
                  json_extract_string(request_parameters, '$.state')
                ORDER BY started_at DESC
              ) AS latest
              FROM meta.ingestion_run
              WHERE source_id='census_acs5'
                AND cast(json_extract_string(request_parameters, '$.year') AS INTEGER) IN (SELECT unnest(?))
                AND json_extract_string(request_parameters, '$.state') IN (SELECT unnest(?))
            ) WHERE latest=1
            """,
            [years, states],
        ).fetchall()
        artifacts = [
            _artifact_metadata(settings.published_dir / "tract_year_profile.parquet"),
            _artifact_metadata(Path("web/app/data/display-geography.generated.json")),
            _artifact_metadata(Path("web/app/data/areas.generated.json")),
        ]
        quality_count = conn.execute(
            "SELECT count(*) FROM quality.data_quality_result WHERE observed_at >= ?", [started_at]
        ).fetchone()[0]
        conn.execute(
            "UPDATE meta.opportunity_release_manifest SET completed_at=?, status='SUCCEEDED', source_run_ids=?, artifact_manifest=?, quality_finding_count=? WHERE release_id=?",
            [now_utc(), json.dumps([run_id for (run_id,) in runs]), json.dumps(artifacts), quality_count, release_id],
        )
        conn.close()
        typer.echo(f"Completed opportunity release {release_id}")
    except Exception as error:
        _, conn = database()
        conn.execute(
            "UPDATE meta.opportunity_release_manifest SET completed_at=?, status='FAILED', error_message=? WHERE release_id=?",
            [now_utc(), str(error), release_id],
        )
        conn.close()
        raise


@app.command("ingest-geography")
def ingest_geography(state: list[str] = typer.Option(None, "--state")) -> None:
    """Load tract, place, and CBSA reference geography with tract context assignments."""
    settings, conn = database()
    cbsa_archive = download_cbsa_geography(settings)
    cbsa_count = load_cbsa_geography(conn, cbsa_archive, settings.reference_geography_vintage)
    logger.info("loaded CBSAs rows=%s", cbsa_count)
    for state_fips in state or settings.states:
        archive = download_tract_geography(settings, state_fips)
        tract_count = load_tract_geography(conn, archive, state_fips, settings.reference_geography_vintage)
        place_archive = download_place_geography(settings, state_fips)
        place_count = load_place_geography(conn, place_archive, settings.reference_geography_vintage)
        place_assignments, cbsa_assignments = assign_tract_context(conn, state_fips, settings.reference_geography_vintage)
        logger.info(
            "loaded geography state=%s tracts=%s places=%s place_assignments=%s cbsa_assignments=%s",
            state_fips, tract_count, place_count, place_assignments, cbsa_assignments,
        )
    conn.close()


@app.command("ingest-display-geography")
def ingest_display_geography(state: list[str] = typer.Option(None, "--state")) -> None:
    """Load current map-display geography without changing analytical vintage joins."""
    settings, conn = database()
    vintage = settings.display_geography_vintage
    cbsa_archive = download_cbsa_geography(settings, vintage)
    cbsa_count = load_cbsa_geography(conn, cbsa_archive, vintage)
    logger.info("loaded display CBSAs vintage=%s rows=%s", vintage, cbsa_count)
    for state_fips in state or settings.states:
        archive = download_tract_geography(settings, state_fips, vintage)
        tract_count = load_tract_geography(conn, archive, state_fips, vintage)
        place_archive = download_place_geography(settings, state_fips, vintage)
        place_count = load_place_geography(conn, place_archive, vintage)
        place_assignments, cbsa_assignments = assign_tract_context(conn, state_fips, vintage)
        logger.info(
            "loaded display geography vintage=%s state=%s tracts=%s places=%s "
            "place_assignments=%s cbsa_assignments=%s",
            vintage, state_fips, tract_count, place_count, place_assignments, cbsa_assignments,
        )
    conn.close()


@app.command("export-display-geography-web")
def export_display_geography_web_command(
    destination: Path = typer.Option(
        Path("web/app/data/display-geography.generated.json"), "--file"
    ),
    all_loaded_tracts: bool = typer.Option(False, "--all-loaded-tracts"),
) -> None:
    """Write display-only current geography for the web map; never alter metric joins."""
    settings, conn = database()
    count = export_display_geography_web_payload(
        conn,
        destination,
        settings.display_geography_vintage,
        settings.reference_geography_vintage,
        None if all_loaded_tracts else settings.opportunity_cohort_city_geoids,
    )
    conn.close()
    typer.echo(
        f"Wrote {count} display-geometry tracts ({settings.display_geography_vintage}) to {destination}"
    )


@app.command("ingest-lodes")
def ingest_lodes(
    state: list[str] = typer.Option(None, "--state"),
    year: list[int] = typer.Option(None, "--year"),
    job_type: str = typer.Option("JT00", "--job-type"),
    include_flows: bool = typer.Option(False, "--include-flows"),
) -> None:
    """Ingest LODES RAC/WAC data; add OD tract-pair flows only when explicitly requested."""
    settings, conn = database()
    client = LodesClient(settings)
    states = state or settings.lodes_states
    if not states:
        raise typer.BadParameter("Configure LODES states or pass --state dc")
    years = year or settings.lodes_years
    for state_code in states:
        normalized_state = state_code.lower()
        if len(normalized_state) != 2 or not normalized_state.isalpha():
            raise typer.BadParameter(f"Invalid LODES postal state code: {state_code}")
        metadata_assets = client.download_state_metadata(normalized_state)
        release = source_vintage(metadata_assets)
        for metadata_asset in metadata_assets:
            persist_lodes_asset(settings.raw_dir, settings.lodes_release, normalized_state, None, metadata_asset)
        for reporting_year in years:
            run_id = new_run_id()
            conn.execute(
                "INSERT INTO meta.ingestion_run VALUES (?, 'census_lodes', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
                [run_id, now_utc(), f'{{"state": "{normalized_state}", "year": {reporting_year}, "job_type": "{job_type}", "include_flows": {str(include_flows).lower()}}}'],
            )
            downloaded_assets = []
            unavailable_assets: list[str] = []
            try:
                urls = client.data_urls(normalized_state, reporting_year, job_type)
                if not include_flows:
                    urls = {asset_type: url for asset_type, url in urls.items() if asset_type in {"rac", "wac"}}
                for asset_type, url in urls.items():
                    try:
                        downloaded_assets.append(client.download_asset(asset_type, url))
                    except LodesAssetUnavailable:
                        unavailable_assets.append(asset_type)
                asset_paths: dict[str, Path] = {}
                digests: list[str] = []
                for asset in downloaded_assets:
                    asset_path, digest = persist_lodes_asset(
                        settings.raw_dir, settings.lodes_release, normalized_state, reporting_year, asset
                    )
                    asset_paths[asset.asset_type] = asset_path
                    digests.append(digest)
                    conn.execute(
                        "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [str(uuid4()), run_id, asset.url, now_utc(), str(asset_path), digest, len(asset.content), "lodes-8.4", "See source catalog"],
                    )
                observation_rows = []
                if "rac" in asset_paths:
                    observation_rows.extend(
                        build_observation_rows(asset_paths["rac"], "resident_workers", reporting_year, settings.lodes_geography_vintage, job_type, normalized_state, release, run_id)
                    )
                if "wac" in asset_paths:
                    observation_rows.extend(
                        build_observation_rows(asset_paths["wac"], "workplace_jobs", reporting_year, settings.lodes_geography_vintage, job_type, normalized_state, release, run_id)
                    )
                flow_rows = []
                for asset_type in ("od_main", "od_aux") if include_flows else ():
                    if asset_type in asset_paths:
                        flow_rows.extend(
                            build_flow_rows(asset_paths[asset_type], reporting_year, settings.lodes_geography_vintage, job_type, normalized_state, release, run_id)
                        )
                conn.execute("BEGIN TRANSACTION")
                if observation_rows:
                    conn.executemany("INSERT OR REPLACE INTO standardized.lodes_tract_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", observation_rows)
                if flow_rows:
                    conn.executemany("INSERT OR REPLACE INTO standardized.lodes_tract_flow VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", flow_rows)
                status = "PARTIAL" if unavailable_assets else "SUCCEEDED"
                error_message = None if not unavailable_assets else f"Unavailable official assets: {', '.join(unavailable_assets)}"
                conn.execute(
                    "UPDATE meta.ingestion_run SET completed_at=?, status=?, record_count=?, checksum_sha256=?, error_message=? WHERE run_id=?",
                    [now_utc(), status, len(observation_rows) + len(flow_rows), ",".join(digests), error_message, run_id],
                )
                conn.execute("COMMIT")
                logger.info(
                    "ingested LODES year=%s state=%s observations=%s flows=%s include_flows=%s unavailable=%s",
                    reporting_year, normalized_state, len(observation_rows), len(flow_rows), include_flows, unavailable_assets,
                )
            except Exception as error:
                conn.execute(
                    "UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?",
                    [now_utc(), str(error), run_id],
                )
                logger.exception("LODES ingestion failed year=%s state=%s", reporting_year, normalized_state)
                raise
    conn.close()


@app.command("ingest-qcew")
def ingest_qcew(
    year: int | None = typer.Option(None, "--year"),
    quarter: int | None = typer.Option(None, "--quarter"),
) -> None:
    """Ingest BLS QCEW total-covered county measures without assigning them to tracts."""
    settings, conn = database()
    reporting_year = year or settings.qcew_year
    reporting_quarter = quarter or settings.qcew_quarter
    client = QcewClient(settings)
    run_id = new_run_id()
    conn.execute(
        "INSERT INTO meta.ingestion_run VALUES (?, 'bls_qcew', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
        [run_id, now_utc(), f'{{"year": {reporting_year}, "quarter": {reporting_quarter}, "scope": "county_total_covered"}}'],
    )
    try:
        url, raw = client.fetch_total_covered_counties(reporting_year, reporting_quarter)
        asset_path, digest = persist_qcew_raw(settings.raw_dir, reporting_year, reporting_quarter, raw)
        rows = build_qcew_observations(raw, reporting_year, reporting_quarter, run_id)
        conn.execute("BEGIN TRANSACTION")
        conn.executemany(
            "INSERT OR REPLACE INTO standardized.qcew_county_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.execute(
            "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [str(uuid4()), run_id, url, now_utc(), str(asset_path), digest, len(raw), "qcew-open-data-csv-v1", "See source catalog"],
        )
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', record_count=?, checksum_sha256=? WHERE run_id=?",
            [now_utc(), len(rows), digest, run_id],
        )
        conn.execute("COMMIT")
        logger.info("ingested QCEW year=%s quarter=%s observations=%s", reporting_year, reporting_quarter, len(rows))
    except Exception as error:
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?",
            [now_utc(), str(error), run_id],
        )
        logger.exception("QCEW ingestion failed year=%s quarter=%s", reporting_year, reporting_quarter)
        raise
    finally:
        conn.close()


@app.command("ingest-fhfa-hpi")
def ingest_fhfa_hpi() -> None:
    """Ingest FHFA's official annual tract HPI without treating it as a property valuation."""
    settings, conn = database()
    run_id = new_run_id()
    conn.execute(
        "INSERT INTO meta.ingestion_run VALUES (?, 'fhfa_hpi', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
        [run_id, now_utc(), '{"geography": "tract", "frequency": "annual"}'],
    )
    try:
        url, raw, publication_date, source_vintage = FhfaHpiClient(settings).fetch_tract_hpi()
        asset_path, digest = persist_fhfa_raw(settings.raw_dir, raw)
        record_count = 0
        conn.execute("BEGIN TRANSACTION")
        for chunk in batched(iter_fhfa_observations(asset_path, publication_date, source_vintage, run_id), 100_000):
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.fhfa_hpi_tract_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                chunk,
            )
            record_count += len(chunk)
        conn.execute(
            "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [str(uuid4()), run_id, url, now_utc(), str(asset_path), digest, len(raw), "fhfa-hpi-annual-tract-csv-v1", "Public federal data"],
        )
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', record_count=?, checksum_sha256=? WHERE run_id=?",
            [now_utc(), record_count, digest, run_id],
        )
        conn.execute("COMMIT")
        logger.info("ingested FHFA tract HPI observations=%s", record_count)
    except Exception as error:
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?",
            [now_utc(), str(error), run_id],
        )
        logger.exception("FHFA tract HPI ingestion failed")
        raise
    finally:
        conn.close()


@app.command("ingest-zillow-zori")
def ingest_zillow_zori() -> None:
    """Ingest Zillow's ZIP-level rent index without assigning it to census tracts."""
    settings, conn = database()
    run_id = new_run_id()
    conn.execute(
        "INSERT INTO meta.ingestion_run VALUES (?, 'zillow_zori', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
        [run_id, now_utc(), f'{{"geography": "ZIP", "frequency": "monthly", "start_date": "{settings.zillow_zori_start_date}"}}'],
    )
    try:
        url, raw, publication_date, source_vintage = ZillowZoriClient(settings).fetch_zip_zori()
        asset_path, digest = persist_zori_raw(settings.raw_dir, raw)
        record_count = 0
        conn.execute("BEGIN TRANSACTION")
        for chunk in batched(
            iter_zori_observations(
                asset_path, settings.zillow_zori_start_date, publication_date, source_vintage, run_id
            ),
            100_000,
        ):
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.zillow_zori_zip_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                chunk,
            )
            record_count += len(chunk)
        conn.execute(
            "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [str(uuid4()), run_id, url, now_utc(), str(asset_path), digest, len(raw), "zillow-zori-zip-csv-v1", "See source catalog"],
        )
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', record_count=?, checksum_sha256=? WHERE run_id=?",
            [now_utc(), record_count, digest, run_id],
        )
        conn.execute("COMMIT")
        logger.info("ingested Zillow ZIP ZORI observations=%s", record_count)
    except Exception as error:
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?",
            [now_utc(), str(error), run_id],
        )
        logger.exception("Zillow ZORI ingestion failed")
        raise
    finally:
        conn.close()


@app.command("ingest-zillow-zhvi")
def ingest_zillow_zhvi() -> None:
    """Ingest Zillow's ZIP-level home-value index without assigning it to census tracts."""
    settings, conn = database()
    run_id = new_run_id()
    conn.execute(
        "INSERT INTO meta.ingestion_run VALUES (?, 'zillow_zhvi', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
        [run_id, now_utc(), f'{{"geography": "ZIP", "frequency": "monthly", "start_date": "{settings.zillow_zori_start_date}"}}'],
    )
    try:
        url, raw, publication_date, source_vintage = ZillowZhviClient(settings).fetch_zip_zhvi()
        asset_path, digest = persist_zhvi_raw(settings.raw_dir, raw)
        record_count = 0
        conn.execute("BEGIN TRANSACTION")
        for chunk in batched(
            iter_zori_observations(
                asset_path, settings.zillow_zori_start_date, publication_date, source_vintage, run_id
            ),
            100_000,
        ):
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.zillow_zhvi_zip_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                chunk,
            )
            record_count += len(chunk)
        conn.execute(
            "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [str(uuid4()), run_id, url, now_utc(), str(asset_path), digest, len(raw), "zillow-zhvi-zip-csv-v1", "See source catalog"],
        )
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', record_count=?, checksum_sha256=? WHERE run_id=?",
            [now_utc(), record_count, digest, run_id],
        )
        conn.execute("COMMIT")
        logger.info("ingested Zillow ZIP ZHVI observations=%s", record_count)
    except Exception as error:
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?",
            [now_utc(), str(error), run_id],
        )
        logger.exception("Zillow ZHVI ingestion failed")
        raise
    finally:
        conn.close()


@app.command("ingest-fbi-cde")
def ingest_fbi_cde(
    state: list[str] = typer.Option(None, "--state"),
    crime_category: list[str] = typer.Option(None, "--crime-category"),
) -> None:
    """Ingest monthly FBI CDE summarized crime at state resolution; never assign it to tracts."""
    settings, conn = database()
    client = FbiCdeClient(settings)
    states = [item.upper() for item in (state or settings.fbi_cde_states)]
    categories = crime_category or ["violent-crime", "property-crime"]
    run_id = new_run_id()
    conn.execute(
        "INSERT INTO meta.ingestion_run VALUES (?, 'fbi_cde', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
        [run_id, now_utc(), json.dumps({"states": states, "categories": categories, "resolution": "state"})],
    )
    record_count = 0
    digests: list[str] = []
    try:
        conn.execute("BEGIN TRANSACTION")
        for state_abbr in states:
            if len(state_abbr) != 2 or not state_abbr.isalpha():
                raise typer.BadParameter(f"Invalid postal state code: {state_abbr}")
            for category in categories:
                asset = client.fetch_state_category(state_abbr, category)
                asset_path, digest = persist_fbi_cde_raw(settings.raw_dir, asset)
                rows = list(iter_fbi_cde_observations(asset.content, state_abbr, category, run_id))
                conn.executemany(
                    "INSERT OR REPLACE INTO standardized.fbi_cde_state_month_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    rows,
                )
                conn.execute(
                    "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [str(uuid4()), run_id, asset.url, now_utc(), str(asset_path), digest, len(asset.content), "fbi-cde-summarized-json-v1", "See source catalog"],
                )
                record_count += len(rows)
                digests.append(digest)
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', record_count=?, checksum_sha256=? WHERE run_id=?",
            [now_utc(), record_count, ",".join(digests), run_id],
        )
        conn.execute("COMMIT")
        logger.info("ingested FBI CDE state-month observations=%s", record_count)
    except Exception as error:
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?",
            [now_utc(), str(error), run_id],
        )
        raise
    finally:
        conn.close()


@app.command("build-public-safety")
def build_public_safety_command() -> None:
    """Build state-level public-safety context from FBI CDE observations."""
    _, conn = database()
    build_public_safety_profile(conn)
    row_count = conn.execute("SELECT count(*) FROM analytics.state_month_public_safety").fetchone()[0]
    conn.close()
    typer.echo(f"Built analytics.state_month_public_safety with {row_count} rows")


@app.command("ingest-bps")
def ingest_bps(year: list[int] = typer.Option(None, "--year")) -> None:
    """Ingest Census annual county building permits; permits remain county-level authorizations."""
    settings, conn = database()
    years = year or settings.bps_years
    client = BpsClient(settings)
    run_id = new_run_id()
    conn.execute(
        "INSERT INTO meta.ingestion_run VALUES (?, 'census_bps', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
        [run_id, now_utc(), json.dumps({"years": years, "resolution": "county", "frequency": "annual"})],
    )
    record_count = 0
    digests: list[str] = []
    try:
        conn.execute("BEGIN TRANSACTION")
        for reporting_year in years:
            url, raw = client.fetch_county_annual(reporting_year)
            asset_path, digest = persist_bps_raw(settings.raw_dir, reporting_year, raw)
            rows = list(iter_county_observations(asset_path, f"BPS_{reporting_year}", run_id))
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.census_bps_county_annual_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
            conn.execute(
                "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [str(uuid4()), run_id, url, now_utc(), str(asset_path), digest, len(raw), "census-bps-county-annual-txt-v1", "Public federal data"],
            )
            record_count += len(rows)
            digests.append(digest)
        conn.execute(
            "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', record_count=?, checksum_sha256=? WHERE run_id=?",
            [now_utc(), record_count, ",".join(digests), run_id],
        )
        conn.execute("COMMIT")
        logger.info("ingested Census BPS county annual observations=%s", record_count)
    except Exception as error:
        conn.execute("UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?", [now_utc(), str(error), run_id])
        raise
    finally:
        conn.close()


@app.command("build-construction")
def build_construction_command() -> None:
    """Build county-level construction context from Census permit authorizations."""
    _, conn = database()
    build_construction_profile(conn)
    row_count = conn.execute("SELECT count(*) FROM analytics.county_year_construction").fetchone()[0]
    conn.close()
    typer.echo(f"Built analytics.county_year_construction with {row_count} rows")


@app.command("ingest-nbi")
def ingest_nbi() -> None:
    """Ingest FHWA bridge condition summaries at county resolution."""
    settings, conn = database()
    run_id = new_run_id()
    conn.execute("INSERT INTO meta.ingestion_run VALUES (?, 'fhwa_nbi', ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)", [run_id, now_utc(), json.dumps({"year": settings.nbi_year, "resolution": "county"})])
    count, digests = 0, []
    try:
        conn.execute("BEGIN TRANSACTION")
        for state_abbr in settings.nbi_states:
            url, raw = NbiClient(settings).fetch_state(state_abbr)
            asset_path, digest = persist_nbi_raw(settings.raw_dir, state_abbr, settings.nbi_year, raw)
            rows = list(nbi_county_rows(asset_path, settings.nbi_year, run_id))
            conn.executemany("INSERT OR REPLACE INTO standardized.fhwa_nbi_county_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)
            conn.execute("INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [str(uuid4()), run_id, url, now_utc(), str(asset_path), digest, len(raw), "fhwa-nbi-delimited-v1", "Public federal data"])
            count += len(rows)
            digests.append(digest)
        conn.execute("UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', record_count=?, checksum_sha256=? WHERE run_id=?", [now_utc(), count, ",".join(digests), run_id])
        conn.execute("COMMIT")
    except Exception as error:
        conn.execute("UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? WHERE run_id=?", [now_utc(), str(error), run_id])
        raise
    finally:
        conn.close()


@app.command("ingest-private-projects")
def ingest_private_projects(source_file: Path = typer.Option(..., "--file")) -> None:
    """Load reviewed private-investment evidence with announcement/funding separation."""
    settings, conn = database()
    count = ingest_evidence_csv(
        conn,
        settings.raw_dir,
        "private_investment_registry",
        source_file,
        iter_projects,
        """
        INSERT OR REPLACE INTO standardized.private_investment_project (
          project_id, company_name, project_name, investment_type, project_status,
          announcement_date, expected_open_date, capex_usd, expected_jobs, county_geoid,
          latitude, longitude, coordinate_precision, primary_source_url, verification_status,
          ingestion_run_id, evidence_type, funding_status, committed_capex_usd,
          financing_status, actual_open_date, secondary_source_url, source_document_date,
          last_verified_date, confidence_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        "private-investment-csv-v2",
    )
    conn.close()
    typer.echo(f"Loaded {count} reviewed private-investment projects")


@app.command("ingest-public-projects")
def ingest_public_projects(source_file: Path = typer.Option(..., "--file")) -> None:
    """Load public capital and infrastructure projects at their native geography."""
    settings, conn = database()
    count = ingest_evidence_csv(
        conn,
        settings.raw_dir,
        "public_investment_registry",
        source_file,
        iter_public_projects,
        """
        INSERT OR REPLACE INTO standardized.public_investment_project (
          project_id, project_name, sponsor_name, project_type, project_status, funding_status,
          announcement_date, approval_date, construction_start_date, expected_completion_date,
          actual_completion_date, total_project_cost_usd, proposed_funding_usd,
          budgeted_funding_usd, appropriated_funding_usd, awarded_funding_usd,
          spent_funding_usd, geography_type, geography_id, county_geoid, tract_geoid,
          latitude, longitude, coordinate_precision, primary_source_url, secondary_source_url,
          source_document_date, last_verified_date, verification_status, confidence_level,
          ingestion_run_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        "public-investment-csv-v1",
    )
    conn.close()
    typer.echo(f"Loaded {count} reviewed public-investment projects")


@app.command("ingest-regulatory-policies")
def ingest_regulatory_policies(source_file: Path = typer.Option(..., "--file")) -> None:
    """Load time-versioned regulation with official citations and review status."""
    settings, conn = database()
    count = ingest_evidence_csv(
        conn,
        settings.raw_dir,
        "regulatory_policy_registry",
        source_file,
        iter_regulatory_policies,
        """
        INSERT OR REPLACE INTO standardized.regulatory_policy (
          policy_id, jurisdiction_type, state_fips, county_geoid, place_geoid,
          jurisdiction_name, policy_category, policy_dimension, policy_summary,
          effective_date, expiration_date, official_citation, official_source_url,
          last_verified_date, review_status, confidence_level, applicability_note,
          ingestion_run_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        "regulatory-policy-csv-v1",
    )
    conn.close()
    typer.echo(f"Loaded {count} reviewed regulatory policies")


@app.command("ingest-environmental-risk")
def ingest_environmental_risk(source_file: Path = typer.Option(..., "--file")) -> None:
    """Load source-native environmental and insurance risk observations."""
    settings, conn = database()
    count = ingest_evidence_csv(
        conn,
        settings.raw_dir,
        "environmental_risk_registry",
        source_file,
        iter_environmental_risks,
        """
        INSERT OR REPLACE INTO standardized.environmental_risk_observation (
          observation_id, source_record_id, geography_type, geography_id, geography_vintage,
          risk_category, metric_id, value_numeric, value_text, unit, observation_date,
          reference_period_start, reference_period_end, source_vintage, publication_date,
          source_url, assignment_method, review_status, confidence_level, ingestion_run_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        "environmental-risk-csv-v1",
    )
    conn.close()
    typer.echo(f"Loaded {count} reviewed environmental-risk observations")


@app.command("ingest-dc-permits")
def ingest_dc_permits_command(
    year: list[int] = typer.Option(None, "--year"),
) -> None:
    """Ingest current DC building-permit evidence for development discovery."""
    settings, conn = database()
    counts = {
        current_year: ingest_dc_building_permits(conn, settings, current_year)
        for current_year in (year or [2025, 2026])
    }
    conn.close()
    typer.echo(
        "Loaded DC building permits: "
        + ", ".join(f"{current_year}={count}" for current_year, count in counts.items())
    )


@app.command("ingest-fema-flood-dc")
def ingest_fema_flood_dc_command() -> None:
    """Overlay the effective FEMA special-flood-hazard layer onto DC tracts."""
    settings, conn = database()
    count = ingest_fema_flood_dc(conn, settings)
    conn.close()
    typer.echo(f"Loaded {count} DC tract flood-exposure observations")


@app.command("ingest-epa-frs")
def ingest_epa_frs_command(
    state: str = typer.Option("DC", "--state"),
) -> None:
    """Ingest EPA Facility Registry Service sites for one state pilot."""
    settings, conn = database()
    count = ingest_epa_frs(conn, settings, state)
    conn.close()
    typer.echo(f"Loaded {count} EPA FRS facility sites for {state.upper()}")


@app.command("build-private-investment-pins")
def build_private_investment_pins_command() -> None:
    _, conn = database()
    build_phase67_products(conn)
    conn.close()


@app.command("build-phase67")
def build_phase67_command() -> None:
    """Build evidence-safe Phase 6-7 map and comparison products."""
    _, conn = database()
    build_phase67_products(conn)
    counts = conn.execute(
        """
        SELECT
          (SELECT count(*) FROM analytics.public_investment_map_pin),
          (SELECT count(*) FROM analytics.private_investment_map_pin),
          (SELECT count(*) FROM analytics.jurisdiction_regulatory_profile),
          (SELECT count(*) FROM analytics.geography_risk_profile)
        """
    ).fetchone()
    conn.close()
    typer.echo(
        "Built Phase 6-7 products: "
        f"public pins={counts[0]}, private pins={counts[1]}, "
        f"regulatory rows={counts[2]}, risk rows={counts[3]}"
    )


@app.command("build-phase8")
def build_phase8_command() -> None:
    """Build populated Phase 6-8 evidence layers and review queues."""
    _, conn = database()
    build_phase67_products(conn)
    build_phase8_products(conn)
    counts = conn.execute(
        """
        SELECT
          (SELECT count(*) FROM analytics.development_permit_map_pin),
          (SELECT count(*) FROM analytics.development_permit_map_pin
            WHERE signal_tier='MAJOR_CANDIDATE'),
          (SELECT count(*) FROM analytics.environmental_risk_site_map_pin),
          (SELECT count(*) FROM analytics.geography_risk_profile),
          (SELECT count(*) FROM analytics.jurisdiction_regulatory_profile),
          (SELECT count(*) FROM analytics.private_investment_review_queue)
        """
    ).fetchone()
    conn.close()
    typer.echo(
        "Built Phase 8 products: "
        f"permit pins={counts[0]}, major permit candidates={counts[1]}, "
        f"EPA facility pins={counts[2]}, tract risk rows={counts[3]}, "
        f"regulatory rows={counts[4]}, private review candidates={counts[5]}"
    )


@app.command("build-profile")
def build_profile_command() -> None:
    """Build the standardized tract-year analytical profile and trends."""
    settings, conn = database()
    build_profile(
        conn,
        settings.inflation_reference_year,
        settings.reliability.caution_relative_moe,
        settings.reliability.unreliable_relative_moe,
    )
    build_employment_profile(conn)
    build_market_profile(conn)
    accessibility_rows = build_employment_center_accessibility(
        conn,
        settings.employment_center_reporting_year,
        settings.lodes_geography_vintage,
        settings.employment_center_min_workplace_jobs,
    )
    quality_findings = record_profile_quality_results(conn)
    conn.close()
    typer.echo(
        "Built analytics.tract_year_profile and analytics.tract_year_trend "
        f"with {quality_findings} quality findings and {accessibility_rows} employment-accessibility rows"
    )


@app.command("build-market")
def build_market_command() -> None:
    """Build market index momentum from ingested native-frequency market sources."""
    _, conn = database()
    build_market_profile(conn)
    hpi_rows = conn.execute("SELECT count(*) FROM analytics.tract_year_market").fetchone()[0]
    zori_rows = conn.execute("SELECT count(*) FROM analytics.zip_month_rent_market").fetchone()[0]
    housing_market_rows = conn.execute("SELECT count(*) FROM analytics.zip_month_housing_market").fetchone()[0]
    conn.close()
    typer.echo(
        f"Built market layers: tract HPI={hpi_rows} rows; ZIP ZORI={zori_rows} rows; "
        f"ZIP home/rent context={housing_market_rows} rows"
    )


@app.command("export-profile")
def export_profile_command() -> None:
    """Write the trend profile as an open Parquet analytical artifact."""
    settings, conn = database()
    target = settings.published_dir / "tract_year_profile.parquet"
    export_profile(conn, target)
    conn.close()
    typer.echo(f"Wrote {target}")


@app.command("export-phase67")
def export_phase67_command() -> None:
    """Write Phase 6-7 CSV products for the website and BI tools."""
    settings, conn = database()
    build_phase67_products(conn)
    destinations = export_phase67(conn, settings.published_dir)
    conn.close()
    typer.echo(f"Wrote {len(destinations)} Phase 6-7 extracts to {settings.published_dir}")


@app.command("export-phase8")
def export_phase8_command() -> None:
    """Write populated Phase 6-8 CSV products for the website and BI tools."""
    settings, conn = database()
    build_phase67_products(conn)
    build_phase8_products(conn)
    destinations = export_phase67(conn, settings.published_dir)
    destinations.extend(export_phase8(conn, settings.published_dir))
    conn.close()
    typer.echo(f"Wrote {len(destinations)} Phase 6-8 extracts to {settings.published_dir}")


@app.command("export-phase8-web")
def export_phase8_web_command(
    destination: Path = typer.Option(
        Path("web/app/data/phase8.generated.json"), "--file"
    ),
) -> None:
    """Write the compact Phase 8 website map and evidence payload."""
    _, conn = database()
    build_phase67_products(conn)
    build_phase8_products(conn)
    target = export_phase8_web_payload(conn, destination)
    conn.close()
    typer.echo(f"Wrote {target}")


@app.command("ingest-usaspending-dc")
def ingest_usaspending_dc_command(
    start_date: str = typer.Option("2024-01-01", "--start-date"),
    minimum_award_usd: float = typer.Option(1_000_000, "--minimum-award-usd", min=0),
) -> None:
    """Discover recent federal infrastructure awards performed in DC."""
    settings, conn = database()
    try:
        parsed_start_date = date.fromisoformat(start_date)
    except ValueError as error:
        raise typer.BadParameter("--start-date must use YYYY-MM-DD") from error
    count = ingest_usaspending_dc(conn, settings, parsed_start_date, minimum_award_usd)
    conn.close()
    typer.echo(f"Loaded {count} USAspending infrastructure candidates for analyst review")


@app.command("ingest-dc-property-records")
def ingest_dc_property_records_command(
    assessments: bool = typer.Option(True, "--assessments/--skip-assessments"),
    residential_cama: bool = typer.Option(True, "--residential-cama/--skip-residential-cama"),
) -> None:
    """Load DC assessment, tax, recorded-sale, and residential CAMA context."""
    settings, conn = database()
    assessment_count = (
        ingest_dc_property_assessments(conn, settings) if assessments else 0
    )
    characteristic_count = (
        ingest_dc_cama_residential(conn, settings) if residential_cama else 0
    )
    conn.close()
    typer.echo(
        "Loaded DC public property records: "
        f"assessments={assessment_count}, residential characteristics={characteristic_count}"
    )


@app.command("ingest-expanded-property-records")
def ingest_expanded_property_records_command(
    start_date: str = typer.Option("2023-01-01", "--start-date"),
    minimum_sale_price: float = typer.Option(
        10_000, "--minimum-sale-price", min=0
    ),
) -> None:
    """Load recent Baltimore and Philadelphia public property records."""
    settings, conn = database()
    try:
        parsed_start_date = date.fromisoformat(start_date)
    except ValueError as error:
        raise typer.BadParameter("--start-date must use YYYY-MM-DD") from error
    baltimore_count = ingest_baltimore_property_records(
        conn, settings, parsed_start_date, minimum_sale_price
    )
    philadelphia_count = ingest_philadelphia_property_records(
        conn, settings, parsed_start_date, minimum_sale_price
    )
    conn.close()
    typer.echo(
        "Loaded expanded public property records: "
        f"Baltimore={baltimore_count}, Philadelphia={philadelphia_count}"
    )


@app.command("load-market-rollout")
def load_market_rollout_command(
    source_file: Path = typer.Option(Path("reference/market_rollout.csv"), "--file"),
) -> None:
    """Load the explicit market expansion sequence and connector requirements."""
    _, conn = database()
    count = load_market_rollout(conn, source_file)
    conn.close()
    typer.echo(f"Loaded {count} market rollout records")


@app.command("build-remaining-gaps")
def build_remaining_gaps_command() -> None:
    """Build public-investment, property-record, and market-readiness products."""
    _, conn = database()
    build_remaining_gap_products(conn)
    counts = conn.execute(
        """
        SELECT
          (SELECT count(*) FROM analytics.public_investment_review_queue),
          (SELECT count(*) FROM analytics.property_public_context),
          (SELECT count(*) FROM analytics.property_public_comp_candidate),
          (SELECT count(*) FROM analytics.market_rollout_coverage)
        """
    ).fetchone()
    conn.close()
    typer.echo(
        "Built remaining-gap products: "
        f"public awards={counts[0]}, property records={counts[1]}, "
        f"recent qualified sales={counts[2]}, rollout markets={counts[3]}"
    )


@app.command("export-remaining-gaps")
def export_remaining_gaps_command() -> None:
    """Write public-investment, property-record, and rollout CSV extracts."""
    settings, conn = database()
    build_remaining_gap_products(conn)
    destinations = export_remaining_gaps(conn, settings.published_dir)
    conn.close()
    typer.echo(f"Wrote {len(destinations)} remaining-gap extracts to {settings.published_dir}")


@app.command("export-remaining-gaps-web")
def export_remaining_gaps_web_command(
    destination: Path = typer.Option(
        Path("web/app/data/remaining-gaps.generated.json"), "--file"
    ),
) -> None:
    """Write the compact public-record and market-rollout website payload."""
    _, conn = database()
    build_remaining_gap_products(conn)
    target = export_remaining_gaps_web_payload(conn, destination)
    conn.close()
    typer.echo(f"Wrote {target}")


@app.command("export-tableau")
def export_tableau_command() -> None:
    settings, conn = database()
    export_tableau_tract_map(conn, settings.published_dir / "tableau_tract_map.csv")
    export_private_investment_pins(conn, settings.published_dir / "private_investment_map_pins.csv")
    conn.close()
    typer.echo(f"Wrote Tableau-ready extracts to {settings.published_dir}")


@app.command("export-tableau-boundaries")
def export_tableau_boundaries_command(
    simplify_tolerance: float = typer.Option(
        0.003,
        "--simplify-tolerance",
        min=0.0,
        help="WGS84 degrees used to simplify tract boundaries for browser rendering.",
    ),
) -> None:
    """Write a Tableau spatial file for the latest tract-level choropleth."""
    settings, conn = database()
    target = settings.published_dir / "tableau_tract_boundaries.geojson"
    export_tableau_tract_boundaries(conn, target, simplify_tolerance)
    conn.close()
    typer.echo(f"Wrote {target}")


@app.command("export-tableau-county-overview")
def export_tableau_county_overview_command() -> None:
    """Write a light national county choropleth for the Tableau overview map."""
    settings, conn = database()
    target = settings.published_dir / "tableau_county_overview.geojson"
    export_tableau_county_overview(conn, target)
    conn.close()
    typer.echo(f"Wrote {target}")


@app.command("export-powerbi")
def export_powerbi_command() -> None:
    """Write flat, Power BI-ready county, tract, and project-pin CSV files."""
    settings, conn = database()
    export_powerbi_county_overview(conn, settings.published_dir / "powerbi_county_overview.csv")
    export_powerbi_tract_overview(conn, settings.published_dir / "powerbi_tract_overview.csv")
    export_private_investment_pins(conn, settings.published_dir / "powerbi_investment_pins.csv")
    conn.close()
    typer.echo(f"Wrote Power BI-ready CSV files to {settings.published_dir}")


@app.command("serve-dashboard")
def serve_dashboard_command(
    host: str = typer.Option("127.0.0.1", "--host"),
    port: int = typer.Option(8787, "--port"),
) -> None:
    """Run the local, read-only exploration dashboard."""
    settings = load_settings()
    serve_dashboard(settings.database_path, host, port)


if __name__ == "__main__":
    app()
