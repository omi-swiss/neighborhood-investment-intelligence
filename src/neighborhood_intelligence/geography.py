from __future__ import annotations

import json
from pathlib import Path
from zipfile import ZipFile
import httpx

from .config import Settings


def tiger_tract_url(settings: Settings, vintage: str, state_fips: str) -> str:
    return f"{settings.tiger_base}/TIGER{vintage}/TRACT/tl_{vintage}_{state_fips}_tract.zip"


def tiger_place_url(settings: Settings, vintage: str, state_fips: str) -> str:
    return f"{settings.tiger_base}/TIGER{vintage}/PLACE/tl_{vintage}_{state_fips}_place.zip"


def tiger_cbsa_url(settings: Settings, vintage: str) -> str:
    return f"{settings.tiger_base}/TIGER{vintage}/CBSA/tl_{vintage}_us_cbsa.zip"


def download_tiger_archive(settings: Settings, source_name: str, url: str, destination: Path) -> Path:
    """Cache an official TIGER/Line archive without overwriting its raw evidence."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        response = httpx.get(url, timeout=settings.request_timeout_seconds)
        response.raise_for_status()
        destination.write_bytes(response.content)
    return destination


def download_tract_geography(settings: Settings, state_fips: str, vintage: str | None = None) -> Path:
    vintage = vintage or settings.reference_geography_vintage
    destination = settings.raw_dir / "census_tiger" / vintage / f"state={state_fips}" / "tract.zip"
    return download_tiger_archive(settings, "tract", tiger_tract_url(settings, vintage, state_fips), destination)


def download_place_geography(settings: Settings, state_fips: str, vintage: str | None = None) -> Path:
    vintage = vintage or settings.reference_geography_vintage
    destination = settings.raw_dir / "census_tiger" / vintage / f"state={state_fips}" / "place.zip"
    return download_tiger_archive(settings, "place", tiger_place_url(settings, vintage, state_fips), destination)


def download_cbsa_geography(settings: Settings, vintage: str | None = None) -> Path:
    vintage = vintage or settings.reference_geography_vintage
    destination = settings.raw_dir / "census_tiger" / vintage / "cbsa" / "us.zip"
    return download_tiger_archive(settings, "cbsa", tiger_cbsa_url(settings, vintage), destination)


def _read_tiger_archive(archive: Path):
    try:
        import geopandas as gpd
    except ImportError as error:
        raise RuntimeError("Install the geospatial extra: uv sync --extra geospatial") from error
    with ZipFile(archive) as bundle:
        shp_name = next(name for name in bundle.namelist() if name.endswith(".shp"))
        extract_dir = archive.parent / "extracted"
        bundle.extractall(extract_dir)
    return gpd.read_file(extract_dir / shp_name)


def persist_geographies(conn: object, rows: list[tuple[object, ...]]) -> int:
    """Upsert geography records by stable geography ID without ambiguity."""
    if not rows:
        return 0
    conn.executemany(
        """
        INSERT INTO standardized.geography VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(geography_id) DO UPDATE SET
          name=excluded.name, parent_geography_id=excluded.parent_geography_id,
          valid_from=excluded.valid_from, valid_to=excluded.valid_to,
          geometry_wkt=excluded.geometry_wkt, centroid_lon=excluded.centroid_lon,
          centroid_lat=excluded.centroid_lat, land_area_m2=excluded.land_area_m2,
          water_area_m2=excluded.water_area_m2, source_id=excluded.source_id
        """,
        rows,
    )
    return len(rows)


def load_tract_geography(conn: object, archive: Path, state_fips: str, vintage: str) -> int:
    frame = _read_tiger_archive(archive)
    rows = []
    for feature in frame.itertuples():
        rows.append((f"tract:{feature.GEOID}:{vintage}", "tract", feature.GEOID, feature.NAMELSAD, f"county:{feature.STATEFP}{feature.COUNTYFP}:{vintage}", None, None, vintage, feature.geometry.wkt, feature.geometry.centroid.x, feature.geometry.centroid.y, int(feature.ALAND), int(feature.AWATER), "census_tiger"))
    return persist_geographies(conn, rows)


def load_place_geography(conn: object, archive: Path, vintage: str) -> int:
    """Load incorporated places and CDPs into the versioned geography dimension."""
    frame = _read_tiger_archive(archive)
    rows = [
        (
            f"place:{feature.GEOID}:{vintage}", "place", feature.GEOID, feature.NAME, None,
            None, None, vintage, feature.geometry.wkt, feature.geometry.centroid.x,
            feature.geometry.centroid.y, int(feature.ALAND), int(feature.AWATER), "census_tiger",
        )
        for feature in frame.itertuples()
    ]
    return persist_geographies(conn, rows)


def load_cbsa_geography(conn: object, archive: Path, vintage: str) -> int:
    """Load national core-based statistical areas into the geography dimension."""
    frame = _read_tiger_archive(archive)
    rows = [
        (
            f"cbsa:{feature.GEOID}:{vintage}", "cbsa", feature.GEOID, feature.NAME, None,
            None, None, vintage, feature.geometry.wkt, feature.geometry.centroid.x,
            feature.geometry.centroid.y, int(feature.ALAND), int(feature.AWATER), "census_tiger",
        )
        for feature in frame.itertuples()
    ]
    return persist_geographies(conn, rows)


def persist_geography_assignments(
    conn: object,
    matches: list[tuple[str, str]],
    assignment_type: str,
    vintage: str,
) -> int:
    """Persist a spatial assignment with its method, source, and confidence."""
    values = [
        (tract_id, geography_id, assignment_type, "TRACT_CENTROID_WITHIN", vintage, "census_tiger", "HIGH")
        for tract_id, geography_id in matches
    ]
    if values:
        conn.executemany("INSERT OR REPLACE INTO standardized.geography_assignment VALUES (?, ?, ?, ?, ?, ?, ?)", values)
    return len(values)


def assign_tract_context(conn: object, state_fips: str, vintage: str) -> tuple[int, int]:
    """Assign tracts to place and CBSA polygons using tract centroids.

    A missing assignment is meaningful: unincorporated tracts may be outside a
    Census place, and rural tracts may be outside a CBSA. The join method is
    persisted so downstream products do not mistake this for a boundary overlay.
    """
    try:
        import geopandas as gpd
        from shapely import wkt
    except ImportError as error:
        raise RuntimeError("Install the geospatial extra: uv sync --extra geospatial") from error

    tract_rows = conn.execute(
        "SELECT geography_id, geometry_wkt FROM standardized.geography "
        "WHERE geography_type='tract' AND geography_vintage=? AND geoid LIKE ?",
        [vintage, f"{state_fips}%"],
    ).fetchall()
    tract_frame = gpd.GeoDataFrame(
        [(geography_id, wkt.loads(geometry)) for geography_id, geometry in tract_rows],
        columns=["tract_id", "geometry"], crs="EPSG:4269",
    )
    if tract_frame.empty:
        return 0, 0
    # Calculate centroids in a national equal-area CRS, then return to the
    # TIGER geographic CRS for the containment joins.
    centroid_frame = tract_frame.to_crs("EPSG:5070")
    centroid_frame["geometry"] = centroid_frame.geometry.centroid
    centroid_frame = centroid_frame.to_crs(tract_frame.crs)
    place_rows = conn.execute(
        "SELECT geography_id, geometry_wkt FROM standardized.geography "
        "WHERE geography_type='place' AND geography_vintage=? AND geoid LIKE ?",
        [vintage, f"{state_fips}%"],
    ).fetchall()
    cbsa_rows = conn.execute(
        "SELECT geography_id, geometry_wkt FROM standardized.geography "
        "WHERE geography_type='cbsa' AND geography_vintage=?", [vintage],
    ).fetchall()

    def join_layer(layer_rows: list[tuple[str, str]]) -> list[tuple[str, str]]:
        if not layer_rows:
            return []
        layer = gpd.GeoDataFrame(
            [(geography_id, wkt.loads(geometry)) for geography_id, geometry in layer_rows],
            columns=["geography_id", "geometry"], crs="EPSG:4269",
        )
        matches = gpd.sjoin(centroid_frame, layer, how="inner", predicate="within")
        return list(matches[["tract_id", "geography_id"]].itertuples(index=False, name=None))

    return (
        persist_geography_assignments(conn, join_layer(place_rows), "place", vintage),
        persist_geography_assignments(conn, join_layer(cbsa_rows), "cbsa", vintage),
    )


def export_display_geography_web_payload(
    conn: object,
    destination: Path,
    display_vintage: str,
    metric_geography_vintage: str,
    city_geoids: list[str] | None = None,
) -> int:
    """Write display-only tract geometry keyed by stable GEOID.

    This artifact deliberately contains no metrics. Consumers may render its
    current boundary geometry only while retaining the metric source's own
    geography vintage in labels and analytical joins.
    """
    try:
        from shapely import wkt
        from shapely.geometry import mapping
    except ImportError as error:
        raise RuntimeError("Install the geospatial extra before exporting display geometry.") from error
    query = """
        SELECT geoid, geometry_wkt
        FROM standardized.geography AS tract
        WHERE geography_type='tract' AND geography_vintage=? AND geometry_wkt IS NOT NULL
    """
    parameters: list[object] = [display_vintage]
    if city_geoids:
        query += """
          AND EXISTS (
            SELECT 1
            FROM standardized.geography_assignment AS assignment
            JOIN standardized.geography AS place
              ON place.geography_id = assignment.assigned_geography_id
            WHERE assignment.subject_geography_id = tract.geography_id
              AND assignment.assignment_type = 'place'
              AND place.geoid IN (SELECT unnest(?))
          )
        """
        parameters.append(city_geoids)
    query += """
        ORDER BY geoid
    """
    rows = conn.execute(query, parameters).fetchall()
    payload = {
        "version": 1,
        "displayGeographyVintage": display_vintage,
        "metricGeographyVintage": metric_geography_vintage,
        "source": "U.S. Census Bureau TIGER/Line",
        "sourceUrl": "https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html",
        "areas": {geoid: mapping(wkt.loads(geometry_wkt)) for geoid, geometry_wkt in rows},
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    return len(rows)
