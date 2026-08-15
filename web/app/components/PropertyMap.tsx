"use client";

import { useEffect, useMemo, useState } from "react";
import type { PropertyWithDerived } from "../lib/property-domain";
import type { AreaRecord } from "../lib/types";

type Point = [number, number];
type Bounds = { west: number; east: number; south: number; north: number };

const marketByCity: Record<string, string> = {
  Washington: "place:1150000",
  Baltimore: "place:2404000",
  Philadelphia: "place:4260000",
  Detroit: "place:2622000",
  Charlotte: "place:3712000",
  Charleston: "place:4513330",
  Boston: "place:2507000",
  Tampa: "place:1271000",
  Chicago: "place:1714000",
};

function rings(area: AreaRecord): number[][][] {
  if (area.geometry.type === "Polygon") return area.geometry.coordinates as number[][][];
  return (area.geometry.coordinates as number[][][][]).flatMap((polygon) => polygon);
}

function boundsFor(areas: AreaRecord[]): Bounds {
  const points = areas.flatMap((area) => rings(area).flat());
  if (!points.length) return { west: -77.12, east: -76.9, south: 38.79, north: 39.01 };
  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  return {
    west: west - Math.max((east - west) * 0.08, 0.01),
    east: east + Math.max((east - west) * 0.08, 0.01),
    south: south - Math.max((north - south) * 0.08, 0.01),
    north: north + Math.max((north - south) * 0.08, 0.01),
  };
}

function project([longitude, latitude]: Point, bounds: Bounds): [number, number] {
  const padding = 24;
  return [
    padding + ((longitude - bounds.west) / (bounds.east - bounds.west)) * (800 - padding * 2),
    padding + ((bounds.north - latitude) / (bounds.north - bounds.south)) * (520 - padding * 2),
  ];
}

function pathFor(area: AreaRecord, bounds: Bounds): string {
  return rings(area)
    .map((ring) =>
      `M${ring.map((point) => project(point as Point, bounds).map((value) => value.toFixed(2)).join(",")).join("L")}Z`,
    )
    .join("");
}

export function PropertyMap({
  properties,
  selectedId,
  onSelect,
}: {
  properties: PropertyWithDerived[];
  selectedId: number | null;
  onSelect: (property: PropertyWithDerived) => void;
}) {
  const [areas, setAreas] = useState<AreaRecord[]>([]);
  const marketKey = useMemo(() => {
    const ids = properties.map((property) => marketByCity[property.city]).filter(Boolean);
    return [...new Set(ids.length ? ids : [marketByCity.Washington])].sort().join(",");
  }, [properties]);
  const marketIds = marketKey.split(",");

  useEffect(() => {
    const controller = new AbortController();
    const requestedMarketIds = marketKey.split(",");
    Promise.all(requestedMarketIds.map((marketId) =>
      fetch(`/api/areas?market=${encodeURIComponent(marketId)}&page=1&pageSize=10`, {
        signal: controller.signal,
      }).then((response) => response.json() as Promise<{ mapContextItems: AreaRecord[] }>)
    )).then((payloads) => setAreas(payloads.flatMap((payload) => payload.mapContextItems)))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setAreas([]);
      });
    return () => controller.abort();
  }, [marketKey]);

  const bounds = useMemo(() => boundsFor(areas), [areas]);
  const paths = useMemo(() => areas.map((area) => ({ id: area.id, path: pathFor(area, bounds) })), [areas, bounds]);
  const positioned = properties.filter(
    (property) =>
      property.longitude !== null &&
      property.latitude !== null &&
      property.longitude >= bounds.west &&
      property.longitude <= bounds.east &&
      property.latitude >= bounds.south &&
      property.latitude <= bounds.north,
  );

  return (
    <div className="map-wrap property-map-wrap">
      <div className="map-note">
        Authorized property points | {areas.length ? `${marketIds.length} market boundary context` : "Loading boundary context"}
      </div>
      <svg className="map-svg" viewBox="0 0 800 520" role="img" aria-label={`Map of ${positioned.length} imported properties`}>
        {paths.map((area) => (
          <path className="map-area context-area" d={area.path} fill="#e8e9e2" key={area.id} />
        ))}
        {positioned.map((property) => {
          const [cx, cy] = project([property.longitude!, property.latitude!], bounds);
          return (
            <circle
              className={`property-point ${selectedId === property.id ? "selected" : ""}`}
              cx={cx}
              cy={cy}
              key={property.id}
              r={selectedId === property.id ? 10 : 7}
              role="button"
              tabIndex={0}
              aria-label={`${property.address}, ${property.derived.favorabilityStatus}`}
              onClick={() => onSelect(property)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(property);
              }}
            >
              <title>{property.address} | {property.derived.favorabilityStatus}</title>
            </circle>
          );
        })}
      </svg>
      <div className="map-legend">
        {positioned.length} mapped | {properties.length - positioned.length} without supported coordinates
      </div>
    </div>
  );
}
