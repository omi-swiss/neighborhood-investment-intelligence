from __future__ import annotations

import csv
from datetime import date, datetime, timezone
from hashlib import sha256
from io import BytesIO, TextIOWrapper
import json
from pathlib import Path
from typing import Any
from uuid import uuid4
from zipfile import ZipFile

import duckdb
import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .acs import new_run_id, now_utc
from .config import Settings

DC_COUNTY_GEOID = "11001"
DC_BBOX = "-77.12,38.79,-76.90,39.01"
PERMIT_LAYERS = {2025: 17, 2026: 18}
PERMIT_FIELDS = (
    "OBJECTID,DCRAINTERNALNUMBER,ISSUE_DATE,PERMIT_ID,PERMIT_TYPE_NAME,"
    "PERMIT_SUBTYPE_NAME,PERMIT_CATEGORY_NAME,APPLICATION_STATUS_NAME,FULL_ADDRESS,"
    "DESC_OF_WORK,SSL,ZONING,PERMIT_APPLICANT,FEES_PAID,OWNER_NAME,LATITUDE,LONGITUDE,"
    "WARD,NEIGHBORHOODCLUSTER,LASTMODIFIEDDATE"
)


def _start_run(
    conn: duckdb.DuckDBPyConnection, source_id: str, parameters: dict[str, object]
) -> str:
    run_id = new_run_id()
    conn.execute(
        "INSERT INTO meta.ingestion_run VALUES (?, ?, ?, NULL, 'RUNNING', ?, NULL, NULL, NULL)",
        [run_id, source_id, now_utc(), json.dumps(parameters, sort_keys=True)],
    )
    return run_id


def _finish_run(
    conn: duckdb.DuckDBPyConnection,
    run_id: str,
    record_count: int,
    digest: str,
) -> None:
    conn.execute(
        "UPDATE meta.ingestion_run SET completed_at=?, status='SUCCEEDED', "
        "record_count=?, checksum_sha256=? WHERE run_id=?",
        [now_utc(), record_count, digest, run_id],
    )


def _fail_run(conn: duckdb.DuckDBPyConnection, run_id: str, error: Exception) -> None:
    conn.execute(
        "UPDATE meta.ingestion_run SET completed_at=?, status='FAILED', error_message=? "
        "WHERE run_id=?",
        [now_utc(), str(error), run_id],
    )


def _persist_asset(
    conn: duckdb.DuckDBPyConnection,
    raw_dir: Path,
    source_id: str,
    run_id: str,
    source_url: str,
    content: bytes,
    suffix: str,
    schema_version: str,
    license_metadata: str,
) -> str:
    digest = sha256(content).hexdigest()
    target = raw_dir / source_id / f"{date.today().isoformat()}-{digest[:16]}.{suffix}"
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        target.write_bytes(content)
    conn.execute(
        "INSERT INTO raw.source_asset VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
            str(uuid4()),
            run_id,
            source_url,
            now_utc(),
            str(target.relative_to(raw_dir)),
            digest,
            len(content),
            schema_version,
            license_metadata,
        ],
    )
    return digest


class ArcGisClient:
    def __init__(self, settings: Settings) -> None:
        self.timeout = settings.request_timeout_seconds

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=12),
        reraise=True,
    )
    def get_json(self, url: str, params: dict[str, object]) -> dict[str, Any]:
        with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict) or payload.get("error"):
            message = payload.get("error", {}).get("message", "unexpected ArcGIS response")
            raise ValueError(f"ArcGIS request failed: {message}")
        return payload

    def fetch_features(
        self,
        layer_url: str,
        *,
        out_fields: str,
        return_geometry: bool,
        where: str = "1=1",
        geometry: str | None = None,
        output_format: str = "json",
        page_size: int = 2000,
    ) -> tuple[list[dict[str, Any]], bytes, str]:
        query_url = f"{layer_url}/query"
        offset = 0
        features: list[dict[str, Any]] = []
        while True:
            params: dict[str, object] = {
                "where": where,
                "outFields": out_fields,
                "returnGeometry": str(return_geometry).lower(),
                "outSR": "4326",
                "resultOffset": offset,
                "resultRecordCount": page_size,
                "orderByFields": "OBJECTID",
                "f": output_format,
            }
            if geometry:
                params.update(
                    {
                        "geometry": geometry,
                        "geometryType": "esriGeometryEnvelope",
                        "inSR": "4326",
                        "spatialRel": "esriSpatialRelIntersects",
                    }
                )
            payload = self.get_json(query_url, params)
            page = payload.get("features", [])
            if not isinstance(page, list):
                raise ValueError("ArcGIS feature response has an invalid feature collection.")
            features.extend(page)
            if len(page) < page_size:
                break
            offset += len(page)
        raw = json.dumps(
            {"type": "FeatureCollection", "features": features},
            separators=(",", ":"),
        ).encode()
        return features, raw, query_url

    def fetch_features_by_object_ids(
        self,
        layer_url: str,
        *,
        out_fields: str,
        geometry: str,
        chunk_size: int = 100,
    ) -> tuple[list[dict[str, Any]], bytes, str]:
        """Fetch complex polygons by stable IDs instead of fragile result offsets."""
        query_url = f"{layer_url}/query"
        spatial_params: dict[str, object] = {
            "where": "1=1",
            "geometry": geometry,
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
        }
        id_payload = self.get_json(
            query_url,
            {**spatial_params, "returnIdsOnly": "true", "f": "json"},
        )
        object_ids = id_payload.get("objectIds", [])
        if not isinstance(object_ids, list):
            raise ValueError("ArcGIS object-ID response is invalid.")

        def get_chunk(ids: list[object]) -> list[dict[str, Any]]:
            params = {
                "where": "1=1",
                "objectIds": ",".join(str(value) for value in ids),
                "outFields": out_fields,
                "returnGeometry": "true",
                "outSR": "4326",
                "f": "geojson",
            }
            try:
                payload = self.get_json(query_url, params)
                page = payload.get("features", [])
                if not isinstance(page, list):
                    raise ValueError("ArcGIS feature response has an invalid feature collection.")
                return page
            except httpx.HTTPStatusError:
                if len(ids) == 1:
                    raise
                midpoint = len(ids) // 2
                return get_chunk(ids[:midpoint]) + get_chunk(ids[midpoint:])

        features: list[dict[str, Any]] = []
        for offset in range(0, len(object_ids), chunk_size):
            features.extend(get_chunk(object_ids[offset : offset + chunk_size]))
        raw = json.dumps(
            {"type": "FeatureCollection", "features": features},
            separators=(",", ":"),
        ).encode()
        return features, raw, query_url


def _arcgis_datetime(value: object) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value) / 1000, tz=timezone.utc).replace(tzinfo=None)
    text = str(value).strip()
    if text.isdigit():
        return datetime.fromtimestamp(int(text) / 1000, tz=timezone.utc).replace(tzinfo=None)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def _clean_number(value: object) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace("$", "").replace(",", "").strip())
    except ValueError:
        return None


def ingest_dc_building_permits(
    conn: duckdb.DuckDBPyConnection, settings: Settings, year: int
) -> int:
    if year not in PERMIT_LAYERS:
        raise ValueError(f"Supported DC permit years are {sorted(PERMIT_LAYERS)}.")
    layer_url = settings.dc_building_permits_layer_url.format(layer=PERMIT_LAYERS[year])
    run_id = _start_run(conn, "dc_building_permits", {"year": year, "layer_url": layer_url})
    try:
        features, raw, query_url = ArcGisClient(settings).fetch_features(
            layer_url,
            out_fields=PERMIT_FIELDS,
            return_geometry=True,
        )
        rows: list[tuple[object, ...]] = []
        for feature in features:
            attributes = feature.get("attributes", {})
            geometry = feature.get("geometry", {})
            object_id = str(attributes.get("OBJECTID") or "").strip()
            if not object_id:
                continue
            latitude = _clean_number(attributes.get("LATITUDE"))
            longitude = _clean_number(attributes.get("LONGITUDE"))
            if not latitude or not longitude:
                longitude = _clean_number(geometry.get("x"))
                latitude = _clean_number(geometry.get("y"))
            if latitude is not None and not -90 <= latitude <= 90:
                latitude = None
            if longitude is not None and not -180 <= longitude <= 180:
                longitude = None
            issue_at = _arcgis_datetime(attributes.get("ISSUE_DATE"))
            modified_at = _arcgis_datetime(attributes.get("LASTMODIFIEDDATE"))
            rows.append(
                (
                    f"dc-building-permit:{year}:{object_id}",
                    "dc_building_permits",
                    object_id,
                    attributes.get("PERMIT_ID"),
                    DC_COUNTY_GEOID,
                    issue_at.date() if issue_at else None,
                    attributes.get("PERMIT_TYPE_NAME"),
                    attributes.get("PERMIT_SUBTYPE_NAME"),
                    attributes.get("PERMIT_CATEGORY_NAME"),
                    attributes.get("APPLICATION_STATUS_NAME"),
                    attributes.get("FULL_ADDRESS"),
                    attributes.get("DESC_OF_WORK"),
                    attributes.get("SSL"),
                    attributes.get("ZONING"),
                    attributes.get("PERMIT_APPLICANT"),
                    attributes.get("OWNER_NAME"),
                    _clean_number(attributes.get("FEES_PAID")),
                    attributes.get("WARD"),
                    attributes.get("NEIGHBORHOODCLUSTER"),
                    latitude,
                    longitude,
                    layer_url,
                    str(year),
                    modified_at,
                    run_id,
                )
            )
        conn.execute("BEGIN TRANSACTION")
        conn.execute(
            "DELETE FROM standardized.development_permit "
            "WHERE source_id='dc_building_permits' AND source_vintage=?",
            [str(year)],
        )
        if rows:
            conn.executemany(
                "INSERT INTO standardized.development_permit VALUES "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        digest = _persist_asset(
            conn,
            settings.raw_dir,
            "dc_building_permits",
            run_id,
            query_url,
            raw,
            "json",
            "dc-arcgis-building-permits-v1",
            "District of Columbia open data, CC BY 4.0",
        )
        _finish_run(conn, run_id, len(rows), digest)
        conn.execute("COMMIT")
        return len(rows)
    except Exception as error:
        try:
            conn.execute("ROLLBACK")
        except duckdb.TransactionException:
            pass
        _fail_run(conn, run_id, error)
        raise


def ingest_fema_flood_dc(conn: duckdb.DuckDBPyConnection, settings: Settings) -> int:
    run_id = _start_run(conn, "fema_nfhl", {"bbox": DC_BBOX, "layer": 28})
    try:
        features, raw, query_url = ArcGisClient(settings).fetch_features_by_object_ids(
            settings.fema_nfhl_layer_url,
            out_fields="OBJECTID,DFIRM_ID,FLD_AR_ID,FLD_ZONE,ZONE_SUBTY,SFHA_TF",
            geometry=DC_BBOX,
        )
        from shapely import wkt
        from shapely.geometry import shape
        from shapely.ops import unary_union
        import geopandas as gpd

        sfha_shapes = []
        for feature in features:
            properties = feature.get("properties", {})
            if str(properties.get("SFHA_TF", "")).upper() not in {"T", "TRUE", "Y", "YES"}:
                continue
            geometry = feature.get("geometry")
            if geometry:
                candidate = shape(geometry)
                if not candidate.is_empty:
                    sfha_shapes.append(candidate)
        if not features:
            raise ValueError("FEMA NFHL returned no flood-zone features for the DC pilot extent.")
        sfha = unary_union(sfha_shapes) if sfha_shapes else None
        tract_rows = conn.execute(
            "SELECT geoid, geometry_wkt FROM standardized.geography "
            "WHERE geography_type='tract' AND geography_vintage=? AND geoid LIKE '11%'",
            [settings.reference_geography_vintage],
        ).fetchall()
        if not tract_rows:
            raise ValueError("Load DC tract geography before building FEMA flood exposure.")
        tracts = gpd.GeoDataFrame(
            [(geoid, wkt.loads(geometry)) for geoid, geometry in tract_rows],
            columns=["geoid", "geometry"],
            crs="EPSG:4269",
        ).to_crs("EPSG:5070")
        if sfha:
            flood = gpd.GeoSeries([sfha], crs="EPSG:4326").to_crs("EPSG:5070").iloc[0]
            shares = [
                min(1.0, max(0.0, tract.geometry.intersection(flood).area / tract.geometry.area))
                for tract in tracts.itertuples()
            ]
        else:
            shares = [0.0] * len(tracts)
        today = date.today()
        rows = [
            (
                f"fema-nfhl-sfha-share:{tract.geoid}:current",
                None,
                "TRACT",
                tract.geoid,
                settings.reference_geography_vintage,
                "FLOOD",
                "fema_sfha_area_share",
                share,
                None,
                "share_of_tract_area",
                today,
                None,
                None,
                today.isoformat(),
                today,
                settings.fema_nfhl_layer_url,
                "DIRECT_SPATIAL_OVERLAY",
                "VERIFIED",
                "HIGH",
                run_id,
            )
            for tract, share in zip(tracts.itertuples(), shares, strict=True)
        ]
        conn.execute("BEGIN TRANSACTION")
        conn.executemany(
            "INSERT OR REPLACE INTO standardized.environmental_risk_observation VALUES "
            "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        digest = _persist_asset(
            conn,
            settings.raw_dir,
            "fema_nfhl",
            run_id,
            query_url,
            raw,
            "geojson",
            "fema-nfhl-layer-28-geojson-v1",
            "Public federal hazard mapping; screening use only",
        )
        _finish_run(conn, run_id, len(rows), digest)
        conn.execute("COMMIT")
        return len(rows)
    except Exception as error:
        try:
            conn.execute("ROLLBACK")
        except duckdb.TransactionException:
            pass
        _fail_run(conn, run_id, error)
        raise


def _first(row: dict[str, str], *names: str) -> str | None:
    for name in names:
        value = (row.get(name) or "").strip()
        if value:
            return value
    return None


def _frs_risk_category(programs: str, interests: str) -> str:
    evidence = f"{programs} {interests}".upper()
    if "SEMS" in evidence or "SUPERFUND" in evidence or "NPL" in evidence:
        return "SUPERFUND"
    if "ACRES" in evidence or "BROWNFIELD" in evidence:
        return "BROWNFIELD"
    if "RCRA" in evidence or "UST" in evidence:
        return "CONTAMINATION"
    if "TRI" in evidence or "AIR" in evidence:
        return "AIR_QUALITY"
    return "INDUSTRIAL_PROXIMITY"


def ingest_epa_frs(
    conn: duckdb.DuckDBPyConnection, settings: Settings, state_code: str = "DC"
) -> int:
    state = state_code.strip().lower()
    source_url = settings.epa_frs_state_url.format(state=state)
    run_id = _start_run(conn, "epa_frs", {"state": state.upper(), "source_url": source_url})
    try:
        with httpx.Client(
            timeout=max(settings.request_timeout_seconds, 120), follow_redirects=True
        ) as client:
            response = client.get(source_url)
            response.raise_for_status()
            raw = response.content
        with ZipFile(BytesIO(raw)) as bundle:
            csv_files = [item for item in bundle.infolist() if item.filename.lower().endswith(".csv")]
            if not csv_files:
                raise ValueError("EPA FRS state archive contains no CSV file.")
            member = max(csv_files, key=lambda item: item.file_size)
            with bundle.open(member) as binary:
                reader = csv.DictReader(TextIOWrapper(binary, encoding="utf-8-sig", errors="replace"))
                records = [
                    {str(key).strip().upper(): (value or "") for key, value in row.items()}
                    for row in reader
                ]
        today = date.today()
        rows: list[tuple[object, ...]] = []
        for record in records:
            registry_id = _first(record, "REGISTRY_ID", "REGISTRYID")
            name = _first(record, "PRIMARY_NAME", "FACILITY_NAME")
            latitude = _clean_number(_first(record, "LATITUDE83", "LATITUDE"))
            longitude = _clean_number(_first(record, "LONGITUDE83", "LONGITUDE"))
            if not registry_id or not name or latitude is None or longitude is None:
                continue
            if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
                continue
            programs = _first(record, "PGM_SYS_ACRNMS", "PROGRAM_SYSTEM_ACRONYMS") or ""
            interests = _first(record, "INTEREST_TYPES", "INTEREST_TYPE") or ""
            rows.append(
                (
                    f"epa-frs:{registry_id}",
                    registry_id,
                    name,
                    _frs_risk_category(programs, interests),
                    programs or None,
                    interests or None,
                    _first(record, "LOCATION_ADDRESS"),
                    _first(record, "CITY_NAME"),
                    _first(record, "STATE_CODE"),
                    _first(record, "POSTAL_CODE"),
                    _first(record, "FIPS_CODE", "COUNTY_FIPS"),
                    latitude,
                    longitude,
                    _first(record, "ACTIVE_STATUS"),
                    source_url,
                    today.isoformat(),
                    today,
                    "MEDIUM",
                    "PROGRAM_LINKED_FACILITY_NOT_PROOF_OF_CONTAMINATION_OR_VIOLATION",
                    run_id,
                )
            )
        conn.execute("BEGIN TRANSACTION")
        if rows:
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.environmental_risk_site VALUES "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        digest = _persist_asset(
            conn,
            settings.raw_dir,
            "epa_frs",
            run_id,
            source_url,
            raw,
            "zip",
            "epa-frs-state-single-file-v1",
            "Public EPA registry data; program presence is not a risk determination",
        )
        _finish_run(conn, run_id, len(rows), digest)
        conn.execute("COMMIT")
        return len(rows)
    except Exception as error:
        try:
            conn.execute("ROLLBACK")
        except duckdb.TransactionException:
            pass
        _fail_run(conn, run_id, error)
        raise


def build_phase8_products(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.development_permit_map_pin AS
        WITH classified AS (
          SELECT *,
            upper(concat_ws(' ', permit_type, permit_subtype, permit_category, work_description))
              AS permit_evidence,
            CASE
              WHEN upper(coalesce(permit_subtype, '')) = 'NEW BUILDING'
                OR upper(coalesce(work_description, '')) LIKE '%NEW CONSTRUCTION%'
                OR upper(coalesce(work_description, '')) LIKE '%GROUND-UP%'
                OR upper(coalesce(work_description, '')) LIKE '%MIXED-USE%'
                OR upper(coalesce(work_description, '')) LIKE '%MIXED USE%'
                OR upper(coalesce(work_description, '')) LIKE '%DWELLING UNITS%'
                OR upper(coalesce(work_description, '')) LIKE '%APARTMENT BUILDING%'
                OR upper(coalesce(work_description, '')) LIKE '%OFFICE BUILDING%'
                OR upper(coalesce(work_description, '')) LIKE '%DATA CENTER%'
                OR upper(coalesce(work_description, '')) LIKE '%WAREHOUSE%'
                OR upper(coalesce(work_description, '')) LIKE '%HOSPITAL%'
                THEN 'MAJOR_CANDIDATE'
              WHEN upper(concat_ws(' ', permit_type, permit_category)) LIKE '%CONSTRUCTION%'
                THEN 'CONSTRUCTION_ACTIVITY'
              ELSE 'OTHER'
            END AS signal_tier
          FROM standardized.development_permit
          WHERE latitude BETWEEN 38.79 AND 39.01
            AND longitude BETWEEN -77.12 AND -76.90
        )
        SELECT * EXCLUDE (permit_evidence),
          'PERMIT_IS_AUTHORIZED_WORK_NOT_PROJECT_COST_OR_COMPLETION' AS interpretation_note
        FROM classified
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.environmental_risk_site_map_pin AS
        SELECT *,
          'FACILITY_POINT_IS_CONTEXT_NOT_A_PROPERTY_LEVEL_RISK_SCORE' AS map_note
        FROM standardized.environmental_risk_site
        """
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO standardized.private_investment_discovery
        SELECT
          'permit-candidate:' || permit_record_id,
          'dc_building_permits',
          'PERMIT',
          coalesce(owner_name, applicant_name),
          concat_ws(' - ', coalesce(full_address, 'Location unavailable'),
            coalesce(permit_subtype, permit_type, 'Development permit')),
          coalesce(permit_subtype, permit_type),
          issue_date,
          full_address,
          latitude,
          longitude,
          source_url,
          left(work_description, 500),
          'NEEDS_REVIEW',
          current_timestamp,
          ingestion_run_id
        FROM analytics.development_permit_map_pin
        WHERE signal_tier = 'MAJOR_CANDIDATE'
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.private_investment_review_queue AS
        SELECT *
        FROM standardized.private_investment_discovery
        WHERE review_status = 'NEEDS_REVIEW'
        ORDER BY filing_or_record_date DESC NULLS LAST, candidate_id
        """
    )


def export_phase8(conn: duckdb.DuckDBPyConnection, destination_dir: Path) -> list[Path]:
    destination_dir.mkdir(parents=True, exist_ok=True)
    exports = {
        "development_permit_map_pins.csv": "analytics.development_permit_map_pin",
        "environmental_risk_site_map_pins.csv": "analytics.environmental_risk_site_map_pin",
        "private_investment_review_queue.csv": "analytics.private_investment_review_queue",
    }
    destinations = []
    for file_name, relation in exports.items():
        destination = destination_dir / file_name
        destination.unlink(missing_ok=True)
        escaped = str(destination).replace("'", "''")
        conn.execute(f"COPY {relation} TO '{escaped}' (HEADER, DELIMITER ',')")
        destinations.append(destination)
    return destinations


def export_phase8_web_payload(
    conn: duckdb.DuckDBPyConnection, destination: Path
) -> Path:
    """Publish a compact, provenance-bearing Phase 8 payload for the website."""
    development = conn.execute(
        """
        SELECT permit_record_id, coalesce(full_address, 'Location unavailable'),
          coalesce(owner_name, applicant_name), coalesce(permit_subtype, permit_type),
          issue_date, latitude, longitude, signal_tier, source_url
        FROM analytics.development_permit_map_pin
        WHERE signal_tier='MAJOR_CANDIDATE'
        ORDER BY issue_date DESC NULLS LAST, permit_record_id
        """
    ).fetchall()
    environmental = conn.execute(
        """
        SELECT site_id, site_name, risk_category, program_codes, latitude, longitude,
          source_url, interpretation_note
        FROM analytics.environmental_risk_site_map_pin
        ORDER BY risk_category, site_name, site_id
        """
    ).fetchall()
    flood = conn.execute(
        """
        SELECT geography_id, value_numeric
        FROM analytics.geography_risk_profile
        WHERE metric_id='fema_sfha_area_share' AND geography_type='TRACT'
        ORDER BY geography_id
        """
    ).fetchall()
    policies = conn.execute(
        """
        SELECT policy_id, policy_dimension, policy_summary, official_citation,
          official_source_url, last_verified_date, applicability_note
        FROM standardized.regulatory_policy
        WHERE review_status='VERIFIED'
        ORDER BY policy_dimension, policy_id
        """
    ).fetchall()
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "coverage": {
            "label": "Washington, DC pilot",
            "developmentPermitCount": len(development),
            "environmentalSiteCount": len(environmental),
            "floodTractCount": len(flood),
            "regulatoryPolicyCount": len(policies),
        },
        "developmentPins": [
            {
                "id": row[0],
                "address": row[1],
                "ownerOrApplicant": row[2],
                "permitType": row[3],
                "issueDate": row[4].isoformat() if row[4] else None,
                "latitude": row[5],
                "longitude": row[6],
                "signalTier": row[7],
                "sourceUrl": row[8],
                "interpretation": "Permit evidence; project scope, financing, cost, and completion require review.",
            }
            for row in development
        ],
        "environmentalPins": [
            {
                "id": row[0],
                "name": row[1],
                "category": row[2],
                "programCodes": row[3],
                "latitude": row[4],
                "longitude": row[5],
                "sourceUrl": row[6],
                "interpretation": row[7],
            }
            for row in environmental
        ],
        "floodByTract": {row[0]: row[1] for row in flood},
        "policies": [
            {
                "id": row[0],
                "dimension": row[1],
                "summary": row[2],
                "citation": row[3],
                "sourceUrl": row[4],
                "lastVerifiedDate": row[5].isoformat(),
                "applicabilityNote": row[6],
            }
            for row in policies
        ],
        "evidenceRules": {
            "development": "Permits are discovery evidence, not project valuations.",
            "environment": "Facility points are context, not proof of contamination or a property-level risk score.",
            "flood": "FEMA polygon overlap is a tract screening measure, not a property flood determination.",
            "regulation": "Official-source summaries require transaction-specific legal and tax review.",
        },
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    return destination
