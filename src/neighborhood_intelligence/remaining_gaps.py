from __future__ import annotations

import csv
from datetime import date, datetime, timezone
import json
from pathlib import Path
import re
from typing import Any

import duckdb
import httpx
from shapely import wkt
from shapely.geometry import Point, Polygon, shape
from shapely.strtree import STRtree
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import Settings
from .phase8_population import (
    ArcGisClient,
    _arcgis_datetime,
    _clean_number,
    _fail_run,
    _finish_run,
    _persist_asset,
    _start_run,
)

DC_ITSPE_FIELDS = (
    "OBJECTID,INTERNALID,SSL,PREMISEADD,UNITNUMBER,DELCODE,PROPTYPE,USECODE,"
    "LANDAREA,NBHD,NBHDNAME,SUBNBHD,PRMS_WARD,OWNERNAME,CLASSTYPE,TAXRATE,"
    "OLDTOTAL,ASSESSMENT,NEWTOTAL,ANNUALTAX,SALEPRICE,SALEDATE,ACCEPTCODE,"
    "SALETYPE,TOTBALAMT,EXTRACTDAT"
)
DC_CAMA_FIELDS = (
    "OBJECTID,SSL,BATHRM,HF_BATHRM,NUM_UNITS,ROOMS,BEDRM,AYB,YR_RMDL,EYB,"
    "STORIES,SALEDATE,PRICE,QUALIFIED,GBA,STYLE_D,STRUCT_D,GRADE_D,CNDTN_D,"
    "LANDAREA,GIS_LAST_MOD_DTTM"
)
BALTIMORE_PROPERTY_FIELDS = (
    "OBJECTID,PIN,FULLADDR,ZIP_CODE,NEIGHBOR,SALEDATE,SALEPRIC,FULLCASH,"
    "PROPDESC,STRUCTAREA,YEAR_BUILD,SDATLINK"
)
INFRASTRUCTURE_KEYWORDS = {
    "TRANSIT": ("transit", "rail", "station", "metro", "bus rapid"),
    "TRANSPORTATION": ("bridge", "highway", "roadway", "street", "airport", "transportation"),
    "HOUSING": ("housing", "residential", "apartment", "multifamily", "homeless shelter"),
    "WATER": ("water", "sewer", "stormwater", "wastewater", "flood control"),
    "ENERGY": ("energy", "electric", "solar", "grid", "geothermal"),
    "DIGITAL": ("broadband", "fiber", "telecommunication", "data center"),
    "PUBLIC_FACILITY": (
        "construction", "renovation", "rehabilitation", "modernization",
        "facility", "building", "campus", "hospital", "school",
    ),
}


def _date_value(value: object) -> date | None:
    if value in (None, ""):
        return None
    try:
        parsed = _arcgis_datetime(value)
    except (OSError, OverflowError, ValueError):
        parsed = None
    if parsed:
        return parsed.date()
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _datetime_value(value: object) -> datetime | None:
    try:
        return _arcgis_datetime(value)
    except (OSError, OverflowError, ValueError):
        return None


def _integer(value: object) -> int | None:
    number = _clean_number(value)
    return int(number) if number is not None else None


def _text(value: object) -> str | None:
    cleaned = str(value or "").strip()
    return cleaned or None


def _baltimore_sale_date(value: object) -> date | None:
    cleaned = re.sub(r"\D", "", str(value or ""))
    if len(cleaned) != 8:
        return None
    try:
        return datetime.strptime(cleaned, "%m%d%Y").date()
    except ValueError:
        return None


def _philadelphia_tract_geoid(value: object) -> str | None:
    cleaned = str(value or "").strip()
    if not cleaned:
        return None
    try:
        tract_code = int(round(float(cleaned) * 100))
    except ValueError:
        return None
    return f"42101{tract_code:06d}"


def _spatial_index(
    conn: duckdb.DuckDBPyConnection,
    county_fips: str,
    geography_vintage: str,
) -> tuple[list[str], STRtree]:
    rows = conn.execute(
        """
        SELECT geoid, geometry_wkt
        FROM standardized.geography
        WHERE geography_type='tract'
          AND geography_vintage=?
          AND substr(geoid, 1, 5)=?
          AND geometry_wkt IS NOT NULL
        ORDER BY geoid
        """,
        [geography_vintage, county_fips],
    ).fetchall()
    geoids = [row[0] for row in rows]
    return geoids, STRtree([wkt.loads(row[1]) for row in rows])


def _containing_geoid(point: Point, geoids: list[str], tree: STRtree) -> str | None:
    for index in tree.query(point):
        polygon = tree.geometries[index]
        if polygon.covers(point):
            return geoids[index]
    return None


def _esri_polygon_point(geometry: object) -> Point | None:
    if not isinstance(geometry, dict):
        return None
    rings = geometry.get("rings")
    if not isinstance(rings, list):
        return None
    polygons = []
    for ring in rings:
        if not isinstance(ring, list) or len(ring) < 4:
            continue
        try:
            polygon = Polygon(ring)
        except (TypeError, ValueError):
            continue
        if not polygon.is_empty and polygon.area > 0:
            polygons.append(polygon)
    return max(polygons, key=lambda polygon: polygon.area).representative_point() if polygons else None


def _philadelphia_neighborhood_index(
    payload: dict[str, Any],
) -> tuple[list[str], STRtree]:
    names: list[str] = []
    geometries = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry")
        properties = feature.get("properties", {})
        if not geometry:
            continue
        names.append(
            _text(properties.get("LISTNAME"))
            or _text(properties.get("MAPNAME"))
            or _text(properties.get("NAME"))
            or "Neighborhood unavailable"
        )
        geometries.append(shape(geometry))
    return names, STRtree(geometries)


def _neighborhood_for_point(
    point: Point | None,
    names: list[str],
    tree: STRtree,
) -> str | None:
    if point is None:
        return None
    for index in tree.query(point):
        if tree.geometries[index].covers(point):
            return names[index]
    return None


def _project_type(description: str, infrastructure_value: float) -> str | None:
    lowered = description.lower()
    for project_type, keywords in INFRASTRUCTURE_KEYWORDS.items():
        if any(re.search(rf"\b{re.escape(keyword)}\b", lowered) for keyword in keywords):
            return project_type
    return "OTHER_INFRASTRUCTURE" if infrastructure_value > 0 else None


class UsaSpendingClient:
    def __init__(self, settings: Settings) -> None:
        self.url = settings.usaspending_award_search_url
        self.timeout = settings.request_timeout_seconds

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=12),
        reraise=True,
    )
    def post(self, payload: dict[str, object]) -> dict[str, Any]:
        with httpx.Client(timeout=max(self.timeout, 90)) as client:
            response = client.post(self.url, json=payload)
            response.raise_for_status()
            data = response.json()
        if not isinstance(data, dict) or not isinstance(data.get("results"), list):
            raise ValueError("USAspending returned an unexpected award-search response.")
        return data

    def fetch_dc_awards(
        self,
        start_date: date,
        end_date: date,
        minimum_award_usd: float,
    ) -> tuple[list[dict[str, Any]], bytes]:
        award_groups = [
            (
                ["A", "B", "C", "D"],
                ["Contract Award Type"],
            ),
            (
                ["02", "03", "04", "05"],
                ["Award Type"],
            ),
            (
                ["09", "11"],
                ["Award Type"],
            ),
        ]
        base_fields = [
            "Award ID", "Recipient Name", "Start Date", "End Date", "Award Amount",
            "Total Outlays", "Awarding Agency", "Funding Agency", "Description",
            "Last Modified Date", "Base Obligation Date", "Place of Performance State Code",
            "Place of Performance City Code", "Place of Performance Zip5",
            "Primary Place of Performance", "Infrastructure Obligations",
            "Infrastructure Outlays", "generated_internal_id",
        ]
        records: list[dict[str, Any]] = []
        request_log: list[dict[str, object]] = []
        for award_codes, type_fields in award_groups:
            page = 1
            while True:
                payload: dict[str, object] = {
                    "subawards": False,
                    "limit": 100,
                    "page": page,
                    "filters": {
                        "award_type_codes": award_codes,
                        "time_period": [
                            {
                                "start_date": start_date.isoformat(),
                                "end_date": end_date.isoformat(),
                            }
                        ],
                        "place_of_performance_locations": [
                            {"country": "USA", "state": "DC"}
                        ],
                        "award_amounts": [{"lower_bound": minimum_award_usd}],
                    },
                    "fields": base_fields + type_fields,
                    "sort": "Award Amount",
                    "order": "desc",
                }
                response = self.post(payload)
                page_records = response["results"]
                records.extend(page_records)
                request_log.append(
                    {
                        "award_type_codes": award_codes,
                        "page": page,
                        "record_count": len(page_records),
                    }
                )
                if not response.get("page_metadata", {}).get("hasNext"):
                    break
                page += 1
                if page > 100:
                    raise ValueError("USAspending pagination exceeded the configured safety limit.")
        raw = json.dumps(
            {"requests": request_log, "results": records},
            separators=(",", ":"),
        ).encode()
        return records, raw


class PublicPropertyClient:
    def __init__(self, settings: Settings) -> None:
        self.timeout = settings.request_timeout_seconds

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(min=1, max=12),
        reraise=True,
    )
    def get_json(self, url: str, params: dict[str, object] | None = None) -> dict[str, Any]:
        with httpx.Client(timeout=max(self.timeout, 90), follow_redirects=True) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
        if not isinstance(payload, dict) or payload.get("error"):
            raise ValueError(
                f"Public property source returned an unexpected response: {payload.get('error')}"
            )
        return payload


def ingest_usaspending_dc(
    conn: duckdb.DuckDBPyConnection,
    settings: Settings,
    start_date: date = date(2024, 1, 1),
    minimum_award_usd: float = 1_000_000,
) -> int:
    end_date = date.today()
    run_id = _start_run(
        conn,
        "usaspending",
        {
            "place_of_performance": "DC",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "minimum_award_usd": minimum_award_usd,
        },
    )
    try:
        records, raw = UsaSpendingClient(settings).fetch_dc_awards(
            start_date, end_date, minimum_award_usd
        )
        rows: list[tuple[object, ...]] = []
        for record in records:
            award_id = str(record.get("Award ID") or "").strip()
            if not award_id:
                continue
            description = str(record.get("Description") or "").strip()
            infrastructure_obligations = _clean_number(
                record.get("Infrastructure Obligations")
            ) or 0.0
            infrastructure_outlays = _clean_number(record.get("Infrastructure Outlays")) or 0.0
            project_type = _project_type(
                description, infrastructure_obligations + infrastructure_outlays
            )
            if not project_type:
                continue
            generated_id = str(record.get("generated_internal_id") or "").strip() or None
            source_url = (
                f"https://www.usaspending.gov/award/{generated_id}/latest"
                if generated_id
                else "https://www.usaspending.gov/search"
            )
            rows.append(
                (
                    f"usaspending:{generated_id or award_id}",
                    award_id,
                    generated_id,
                    record.get("Recipient Name"),
                    description or None,
                    record.get("Contract Award Type") or record.get("Award Type"),
                    _clean_number(record.get("Award Amount")),
                    _clean_number(record.get("Total Outlays")),
                    infrastructure_obligations or None,
                    infrastructure_outlays or None,
                    _date_value(record.get("Start Date")),
                    _date_value(record.get("End Date")),
                    _date_value(record.get("Base Obligation Date")),
                    _date_value(record.get("Last Modified Date")),
                    record.get("Awarding Agency"),
                    record.get("Funding Agency"),
                    json.dumps(record.get("Primary Place of Performance"))
                    if isinstance(record.get("Primary Place of Performance"), dict)
                    else record.get("Primary Place of Performance"),
                    "DC",
                    str(record.get("Place of Performance City Code") or "") or None,
                    str(record.get("Place of Performance Zip5") or "") or None,
                    project_type,
                    "NEEDS_REVIEW",
                    source_url,
                    end_date.isoformat(),
                    run_id,
                )
            )
        conn.execute("BEGIN TRANSACTION")
        conn.execute(
            "DELETE FROM standardized.public_investment_discovery "
            "WHERE place_state_code='DC'"
        )
        conn.execute("COMMIT")
        conn.execute("BEGIN TRANSACTION")
        if rows:
            conn.executemany(
                "INSERT INTO standardized.public_investment_discovery VALUES "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        digest = _persist_asset(
            conn,
            settings.raw_dir,
            "usaspending",
            run_id,
            settings.usaspending_award_search_url,
            raw,
            "json",
            "usaspending-award-search-v2",
            "Public federal spending data; awards require project-level verification",
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


def ingest_dc_property_assessments(
    conn: duckdb.DuckDBPyConnection, settings: Settings
) -> int:
    layer_url = settings.dc_property_layer_url.format(layer=53)
    run_id = _start_run(conn, "dc_property_itspe", {"layer": 53})
    try:
        features, raw, query_url = ArcGisClient(settings).fetch_features(
            layer_url,
            out_fields=DC_ITSPE_FIELDS,
            return_geometry=False,
        )
        rows = []
        for feature in features:
            values = feature.get("attributes", {})
            parcel_id = str(values.get("SSL") or "").strip()
            if not parcel_id:
                continue
            rows.append(
                (
                    parcel_id,
                    str(values.get("INTERNALID") or "") or None,
                    values.get("PREMISEADD"),
                    values.get("UNITNUMBER"),
                    values.get("DELCODE"),
                    values.get("PROPTYPE"),
                    values.get("USECODE"),
                    _clean_number(values.get("LANDAREA")),
                    values.get("NBHD"),
                    values.get("NBHDNAME"),
                    values.get("SUBNBHD"),
                    values.get("PRMS_WARD"),
                    values.get("OWNERNAME"),
                    values.get("CLASSTYPE"),
                    _clean_number(values.get("TAXRATE")),
                    _clean_number(values.get("OLDTOTAL")),
                    _clean_number(values.get("ASSESSMENT")),
                    _clean_number(values.get("NEWTOTAL")),
                    _clean_number(values.get("ANNUALTAX")),
                    _clean_number(values.get("SALEPRICE")),
                    _date_value(values.get("SALEDATE")),
                    values.get("ACCEPTCODE"),
                    values.get("SALETYPE"),
                    _clean_number(values.get("TOTBALAMT")),
                    _date_value(values.get("EXTRACTDAT")),
                    layer_url,
                    date.today().isoformat(),
                    run_id,
                )
            )
        conn.execute("BEGIN TRANSACTION")
        conn.execute("DELETE FROM standardized.property_assessment_record")
        conn.execute("COMMIT")
        conn.execute("BEGIN TRANSACTION")
        if rows:
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.property_assessment_record VALUES "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        digest = _persist_asset(
            conn,
            settings.raw_dir,
            "dc_property_itspe",
            run_id,
            query_url,
            raw,
            "json",
            "dc-itspe-arcgis-v1",
            "District of Columbia open data, CC BY 4.0; assessment-purpose records",
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


def ingest_dc_cama_residential(
    conn: duckdb.DuckDBPyConnection, settings: Settings
) -> int:
    layer_url = settings.dc_property_layer_url.format(layer=25)
    run_id = _start_run(conn, "dc_cama_residential", {"layer": 25})
    try:
        features, raw, query_url = ArcGisClient(settings).fetch_features(
            layer_url,
            out_fields=DC_CAMA_FIELDS,
            return_geometry=False,
        )
        rows = []
        for feature in features:
            values = feature.get("attributes", {})
            parcel_id = str(values.get("SSL") or "").strip()
            if not parcel_id:
                continue
            rows.append(
                (
                    parcel_id,
                    _clean_number(values.get("BATHRM")),
                    _clean_number(values.get("HF_BATHRM")),
                    _integer(values.get("NUM_UNITS")),
                    _integer(values.get("ROOMS")),
                    _integer(values.get("BEDRM")),
                    _integer(values.get("AYB")),
                    _integer(values.get("YR_RMDL")),
                    _integer(values.get("EYB")),
                    _clean_number(values.get("STORIES")),
                    _date_value(values.get("SALEDATE")),
                    _clean_number(values.get("PRICE")),
                    values.get("QUALIFIED"),
                    _clean_number(values.get("GBA")),
                    values.get("STYLE_D"),
                    values.get("STRUCT_D"),
                    values.get("GRADE_D"),
                    values.get("CNDTN_D"),
                    _clean_number(values.get("LANDAREA")),
                    _datetime_value(values.get("GIS_LAST_MOD_DTTM")),
                    layer_url,
                    date.today().isoformat(),
                    run_id,
                )
            )
        conn.execute("BEGIN TRANSACTION")
        conn.execute("DELETE FROM standardized.property_characteristic_residential")
        conn.execute("COMMIT")
        conn.execute("BEGIN TRANSACTION")
        if rows:
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.property_characteristic_residential VALUES "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        digest = _persist_asset(
            conn,
            settings.raw_dir,
            "dc_cama_residential",
            run_id,
            query_url,
            raw,
            "json",
            "dc-cama-residential-arcgis-v1",
            "District of Columbia open data, CC BY 4.0; assessment-purpose records",
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


def ingest_baltimore_property_records(
    conn: duckdb.DuckDBPyConnection,
    settings: Settings,
    start_date: date,
    minimum_sale_price: float = 10_000,
) -> int:
    run_id = _start_run(
        conn,
        "baltimore_real_property",
        {"start_date": start_date.isoformat(), "minimum_sale_price": minimum_sale_price},
    )
    try:
        years = range(start_date.year, date.today().year + 1)
        year_filter = " OR ".join(f"SALEDATE LIKE '%{year}'" for year in years)
        features, raw, query_url = ArcGisClient(settings).fetch_features(
            settings.baltimore_property_layer_url,
            out_fields=BALTIMORE_PROPERTY_FIELDS,
            return_geometry=True,
            where=f"SALEPRIC >= {minimum_sale_price:g} AND ({year_filter})",
            page_size=1000,
        )
        geoids, tract_tree = _spatial_index(
            conn, "24510", settings.reference_geography_vintage
        )
        rows = []
        for feature in features:
            values = feature.get("attributes", {})
            parcel_id = _text(values.get("PIN"))
            sale_date = _baltimore_sale_date(values.get("SALEDATE"))
            if not parcel_id or not sale_date or sale_date < start_date:
                continue
            point = _esri_polygon_point(feature.get("geometry"))
            tract_geoid = _containing_geoid(point, geoids, tract_tree) if point else None
            source_url = _text(values.get("SDATLINK")) or (
                "https://sdat.dat.maryland.gov/RealProperty/Pages/default.aspx"
            )
            rows.append(
                (
                    f"baltimore:{parcel_id}:{sale_date.isoformat()}",
                    "Baltimore",
                    "MD",
                    parcel_id,
                    _text(values.get("FULLADDR")),
                    _text(values.get("ZIP_CODE")),
                    _text(values.get("NEIGHBOR")),
                    tract_geoid,
                    _text(values.get("PROPDESC")),
                    _clean_number(values.get("SALEPRIC")),
                    sale_date,
                    None,
                    None,
                    _clean_number(values.get("STRUCTAREA")),
                    _clean_number(values.get("FULLCASH")),
                    _integer(values.get("YEAR_BUILD")),
                    point.y if point else None,
                    point.x if point else None,
                    "Baltimore City Real Property Information",
                    source_url.replace("http://", "https://"),
                    date.today().isoformat(),
                    run_id,
                )
            )
        conn.execute("BEGIN TRANSACTION")
        conn.execute(
            "DELETE FROM standardized.property_market_record WHERE city='Baltimore'"
        )
        if rows:
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.property_market_record VALUES "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        digest = _persist_asset(
            conn,
            settings.raw_dir,
            "baltimore_real_property",
            run_id,
            query_url,
            raw,
            "json",
            "baltimore-real-property-arcgis-v1",
            "Baltimore City open data; weekly public assessment and recorded-sale context",
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


def ingest_philadelphia_property_records(
    conn: duckdb.DuckDBPyConnection,
    settings: Settings,
    start_date: date,
    minimum_sale_price: float = 10_000,
) -> int:
    run_id = _start_run(
        conn,
        "philadelphia_opa",
        {"start_date": start_date.isoformat(), "minimum_sale_price": minimum_sale_price},
    )
    client = PublicPropertyClient(settings)
    try:
        query = f"""
          SELECT parcel_number, location, census_tract, sale_date, sale_price,
            market_value, category_code_description, number_of_bedrooms,
            number_of_bathrooms, total_livable_area, zip_code, year_built,
            ST_Y(the_geom) AS latitude, ST_X(the_geom) AS longitude
          FROM (
            SELECT *, row_number() OVER (
              PARTITION BY census_tract ORDER BY sale_date DESC, parcel_number
            ) AS recent_rank
            FROM opa_properties_public
            WHERE sale_price >= {minimum_sale_price:g}
              AND sale_date >= '{start_date.isoformat()}'
          ) AS recent_sales
          WHERE recent_rank <= 20
          ORDER BY sale_date DESC, parcel_number
        """
        property_payload = client.get_json(
            settings.philadelphia_property_api_url,
            {"q": " ".join(query.split()), "format": "json"},
        )
        neighborhood_payload = client.get_json(settings.philadelphia_neighborhoods_url)
        neighborhood_names, neighborhood_tree = _philadelphia_neighborhood_index(
            neighborhood_payload
        )
        rows = []
        for values in property_payload.get("rows", []):
            parcel_id = _text(values.get("parcel_number"))
            sale_date = _date_value(values.get("sale_date"))
            if not parcel_id or not sale_date:
                continue
            latitude = _clean_number(values.get("latitude"))
            longitude = _clean_number(values.get("longitude"))
            point = (
                Point(longitude, latitude)
                if latitude is not None and longitude is not None
                else None
            )
            rows.append(
                (
                    f"philadelphia:{parcel_id}:{sale_date.isoformat()}",
                    "Philadelphia",
                    "PA",
                    parcel_id,
                    _text(values.get("location")),
                    _text(values.get("zip_code")),
                    _neighborhood_for_point(
                        point, neighborhood_names, neighborhood_tree
                    ),
                    _philadelphia_tract_geoid(values.get("census_tract")),
                    _text(values.get("category_code_description")),
                    _clean_number(values.get("sale_price")),
                    sale_date,
                    _integer(values.get("number_of_bedrooms")),
                    _clean_number(values.get("number_of_bathrooms")),
                    _clean_number(values.get("total_livable_area")),
                    _clean_number(values.get("market_value")),
                    _integer(values.get("year_built")),
                    latitude,
                    longitude,
                    "Philadelphia Office of Property Assessment",
                    f"https://property.phila.gov/?p={parcel_id}",
                    date.today().isoformat(),
                    run_id,
                )
            )
        conn.execute("BEGIN TRANSACTION")
        conn.execute(
            "DELETE FROM standardized.property_market_record WHERE city='Philadelphia'"
        )
        if rows:
            conn.executemany(
                "INSERT OR REPLACE INTO standardized.property_market_record VALUES "
                "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        raw = json.dumps(property_payload, separators=(",", ":")).encode()
        digest = _persist_asset(
            conn,
            settings.raw_dir,
            "philadelphia_opa",
            run_id,
            settings.philadelphia_property_api_url,
            raw,
            "json",
            "philadelphia-opa-carto-v1",
            "City of Philadelphia public assessment and recorded-sale context",
        )
        _persist_asset(
            conn,
            settings.raw_dir,
            "philadelphia_neighborhoods",
            run_id,
            settings.philadelphia_neighborhoods_url,
            json.dumps(neighborhood_payload, separators=(",", ":")).encode(),
            "geojson",
            "opendataphilly-neighborhoods-v1",
            "Robert Cheetham/OpenDataPhilly, CC BY 4.0; approximate neighborhood labels",
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


def load_market_rollout(conn: duckdb.DuckDBPyConnection, path: Path) -> int:
    with path.open(encoding="utf-8-sig", newline="") as source:
        rows = [
            (
                row["market_id"],
                row["market_name"],
                row["cbsa_code"],
                int(row["priority_tier"]),
                row["rollout_status"],
                row["public_record_strategy"],
                row["listing_strategy"],
                row["transit_strategy"],
                row.get("notes") or None,
            )
            for row in csv.DictReader(source)
        ]
    conn.execute("DELETE FROM meta.market_rollout")
    conn.executemany(
        "INSERT INTO meta.market_rollout VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", rows
    )
    return len(rows)


def build_remaining_gap_products(conn: duckdb.DuckDBPyConnection) -> None:
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.public_investment_review_queue AS
        SELECT *,
          'AWARD_PLACE_OF_PERFORMANCE_IS_NOT_A_PROJECT_COORDINATE' AS interpretation_note
        FROM standardized.public_investment_discovery
        WHERE review_status='NEEDS_REVIEW'
        ORDER BY award_amount_usd DESC NULLS LAST, candidate_id
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.property_public_context AS
        SELECT
          assessment.parcel_id,
          assessment.premise_address,
          assessment.unit_number,
          assessment.property_type,
          assessment.use_code,
          coalesce(characteristics.land_area_sqft, assessment.land_area_sqft) AS land_area_sqft,
          assessment.assessment_neighborhood_name,
          assessment.ward,
          assessment.tax_class,
          assessment.tax_rate,
          assessment.current_assessed_value_usd,
          assessment.proposed_assessed_value_usd,
          assessment.annual_tax_usd,
          coalesce(characteristics.latest_sale_price_usd,
            assessment.latest_sale_price_usd) AS latest_sale_price_usd,
          coalesce(characteristics.latest_sale_date,
            assessment.latest_sale_date) AS latest_sale_date,
          characteristics.qualified_sale_flag,
          characteristics.unit_count,
          characteristics.bedroom_count,
          characteristics.bathrooms,
          characteristics.half_bathrooms,
          characteristics.gross_building_area_sqft,
          characteristics.average_year_built,
          characteristics.year_remodeled,
          characteristics.style_description,
          characteristics.structure_description,
          characteristics.grade_description,
          characteristics.condition_description,
          assessment.extract_date,
          assessment.source_url AS assessment_source_url,
          characteristics.source_url AS characteristic_source_url,
          'PUBLIC_RECORD_CONTEXT_NOT_ACTIVE_LISTING_OR_APPRAISAL' AS interpretation_note
        FROM standardized.property_assessment_record AS assessment
        LEFT JOIN standardized.property_characteristic_residential AS characteristics
          USING (parcel_id)
        WHERE coalesce(upper(assessment.record_status), 'A') NOT IN ('D', 'DEAD')
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.property_public_comp_candidate AS
        SELECT *
        FROM analytics.property_public_context
        WHERE upper(trim(coalesce(qualified_sale_flag, '')))='Q'
          AND latest_sale_price_usd > 0
          AND latest_sale_date >= current_date - INTERVAL 3 YEAR
        ORDER BY latest_sale_date DESC, parcel_id
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.property_recent_recorded_sale AS
        SELECT
          'washington:' || parcel_id || ':' || cast(latest_sale_date AS VARCHAR) AS record_id,
          'Washington' AS city,
          'DC' AS state_abbr,
          parcel_id,
          premise_address AS address,
          NULL::VARCHAR AS postal_code,
          assessment_neighborhood_name AS neighborhood,
          NULL::VARCHAR AS tract_geoid,
          property_type,
          latest_sale_price_usd AS sale_price_usd,
          latest_sale_date AS sale_date,
          bedroom_count,
          bathrooms,
          gross_building_area_sqft AS building_square_feet,
          current_assessed_value_usd AS assessed_value_usd,
          average_year_built AS year_built,
          NULL::DOUBLE AS latitude,
          NULL::DOUBLE AS longitude,
          'District of Columbia public property records' AS source_name,
          'https://propertyquest.dc.gov/' AS source_url,
          'QUALIFIED_PUBLIC_RECORD' AS sale_quality
        FROM analytics.property_public_comp_candidate
        UNION ALL
        SELECT
          record_id, city, state_abbr, parcel_id, address, postal_code,
          neighborhood, tract_geoid, property_type, sale_price_usd, sale_date,
          bedroom_count, bathrooms, building_square_feet, assessed_value_usd,
          year_built, latitude, longitude, source_name, source_url,
          'RECORDED_SALE_PRICE_SCREENED' AS sale_quality
        FROM standardized.property_market_record
        WHERE sale_price_usd > 0
          AND sale_date >= current_date - INTERVAL 3 YEAR
        """
    )
    conn.execute(
        """
        CREATE OR REPLACE TABLE analytics.market_rollout_coverage AS
        WITH tract_counts AS (
          SELECT replace(assigned_geography_id, 'cbsa:', '') AS cbsa_vintage,
            count(DISTINCT subject_geography_id) AS tract_boundary_count
          FROM standardized.geography_assignment
          WHERE assignment_type='cbsa'
          GROUP BY assigned_geography_id
        )
        SELECT rollout.*,
          coalesce(tract_counts.tract_boundary_count, 0) AS tract_boundary_count,
          CASE WHEN rollout.rollout_status='LIVE' THEN 'FULL_PILOT'
            WHEN rollout.rollout_status='SCREENER_LIVE' THEN 'SCREENING_ACTIVE'
            WHEN coalesce(tract_counts.tract_boundary_count, 0) > 0 THEN 'BOUNDARIES_READY'
            ELSE 'GEOGRAPHY_PENDING' END AS data_readiness
        FROM meta.market_rollout AS rollout
        LEFT JOIN tract_counts
          ON tract_counts.cbsa_vintage LIKE rollout.cbsa_code || ':%'
        ORDER BY rollout.priority_tier, rollout.market_name
        """
    )


def export_remaining_gaps(
    conn: duckdb.DuckDBPyConnection, destination_dir: Path
) -> list[Path]:
    destination_dir.mkdir(parents=True, exist_ok=True)
    exports = {
        "public_investment_review_queue.csv": "analytics.public_investment_review_queue",
        "property_public_context.csv": "analytics.property_public_context",
        "property_public_comp_candidates.csv": "analytics.property_public_comp_candidate",
        "property_recent_recorded_sales.csv": "analytics.property_recent_recorded_sale",
        "market_rollout_coverage.csv": "analytics.market_rollout_coverage",
    }
    destinations = []
    for file_name, relation in exports.items():
        destination = destination_dir / file_name
        destination.unlink(missing_ok=True)
        escaped = str(destination).replace("'", "''")
        conn.execute(f"COPY {relation} TO '{escaped}' (HEADER, DELIMITER ',')")
        destinations.append(destination)
    return destinations


def export_remaining_gaps_web_payload(
    conn: duckdb.DuckDBPyConnection, destination: Path
) -> Path:
    counts = conn.execute(
        """
        SELECT
          (SELECT count(*) FROM analytics.public_investment_review_queue),
          (
            (SELECT count(*) FROM analytics.property_public_context) +
            (SELECT count(*) FROM standardized.property_market_record)
          ),
          (SELECT count(*) FROM analytics.property_recent_recorded_sale)
        """
    ).fetchone()
    awards = conn.execute(
        """
        SELECT candidate_id, recipient_name, description, award_amount_usd,
          total_outlays_usd, project_type, awarding_agency, source_url
        FROM analytics.public_investment_review_queue
        ORDER BY award_amount_usd DESC NULLS LAST
        LIMIT 100
        """
    ).fetchall()
    comps = conn.execute(
        """
        SELECT parcel_id, address, property_type, sale_price_usd, sale_date,
          bedroom_count, bathrooms, building_square_feet, city, state_abbr,
          neighborhood, tract_geoid, source_url, source_name, sale_quality
        FROM analytics.property_recent_recorded_sale
        QUALIFY row_number() OVER (
          PARTITION BY city, coalesce(tract_geoid, neighborhood, 'citywide')
          ORDER BY sale_date DESC, parcel_id
        ) <= 4
        ORDER BY city, sale_date DESC, parcel_id
        LIMIT 5000
        """
    ).fetchall()
    market_counts = conn.execute(
        """
        SELECT city, count(*) AS record_count,
          count(DISTINCT tract_geoid) FILTER (WHERE tract_geoid IS NOT NULL) AS tract_count,
          max(sale_date) AS latest_sale_date
        FROM analytics.property_recent_recorded_sale
        GROUP BY city
        ORDER BY city
        """
    ).fetchall()
    markets = conn.execute(
        "SELECT * FROM analytics.market_rollout_coverage "
        "ORDER BY priority_tier, market_name"
    ).fetchall()
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "coverage": {
            "publicInvestmentCandidateCount": counts[0],
            "publicPropertyRecordCount": counts[1],
            "recentQualifiedSaleCount": counts[2],
            "propertyMarkets": {
                row[0]: {
                    "recordCount": row[1],
                    "tractCount": row[2],
                    "latestSaleDate": row[3].isoformat() if row[3] else None,
                }
                for row in market_counts
            },
        },
        "publicInvestmentCandidates": [
            {
                "id": row[0],
                "recipient": row[1],
                "description": row[2],
                "awardAmount": row[3],
                "totalOutlays": row[4],
                "projectType": row[5],
                "awardingAgency": row[6],
                "sourceUrl": row[7],
            }
            for row in awards
        ],
        "recentQualifiedSales": [
            {
                "parcelId": row[0],
                "address": row[1],
                "propertyType": row[2],
                "salePrice": row[3],
                "saleDate": row[4].isoformat() if row[4] else None,
                "bedrooms": row[5],
                "bathrooms": row[6],
                "buildingSquareFeet": row[7],
                "assessedValue": None,
                "annualTax": None,
                "city": row[8],
                "state": row[9],
                "neighborhood": row[10],
                "tractGeoid": row[11],
                "postalCode": None,
                "sourceUrl": row[12],
                "sourceName": row[13],
                "yearBuilt": None,
                "latitude": None,
                "longitude": None,
                "saleQuality": row[14],
            }
            for row in comps
        ],
        "markets": [
            {
                "id": row[0],
                "name": row[1],
                "cbsaCode": row[2],
                "priorityTier": row[3],
                "status": row[4],
                "publicRecordStrategy": row[5],
                "listingStrategy": row[6],
                "transitStrategy": row[7],
                "notes": row[8],
                "tractBoundaryCount": row[9],
                "dataReadiness": row[10],
            }
            for row in markets
        ],
        "marketplaceContract": {
            "publicRecords": "Parcel facts, assessments, taxes, and recorded sales; not active listings.",
            "activeListings": "Requires authorized MLS/RESO, licensed vendor, or user-owned feed.",
            "userImports": "Already supported with source and permission attestations.",
        },
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    return destination
