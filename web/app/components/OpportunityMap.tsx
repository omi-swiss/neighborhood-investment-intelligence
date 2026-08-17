"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency, formatPercent } from "../lib/area-shared";
import { buildMarketCenters, investorAreaName } from "../lib/area-insights";
import type { DevelopmentPin, EnvironmentalPin } from "../lib/phase8";
import type { AreaRecord, MarketFocus } from "../lib/types";

type Point = [number, number];
type MapBounds = { west: number; east: number; south: number; north: number };
type MapLayer = "opportunity" | "development" | "flood" | "environment";
type SignalPin =
  | { kind: "development"; item: DevelopmentPin }
  | { kind: "environment"; item: EnvironmentalPin };
type DragState = { start: Point; bounds: MapBounds; boxZoom: boolean };
type OrientationLabel = {
  id: string;
  name: string;
  kind: "city" | "downtown" | "district" | "transit" | "landmark" | "waterfront";
  longitude: number;
  latitude: number;
};

const MAP_WIDTH = 800;
const MAP_HEIGHT = 520;

const MARKET_LANDMARKS: Record<string, OrientationLabel[]> = {
  "place:1150000": [
    { id: "dc-downtown", name: "Downtown", kind: "downtown", longitude: -77.0365, latitude: 38.9007 },
    { id: "dc-capitol", name: "U.S. Capitol", kind: "landmark", longitude: -77.0091, latitude: 38.8899 },
    { id: "dc-union", name: "Union Station", kind: "transit", longitude: -77.0064, latitude: 38.8973 },
    { id: "dc-wharf", name: "The Wharf", kind: "waterfront", longitude: -77.0200, latitude: 38.8766 },
  ],
  "place:2404000": [
    { id: "baltimore-downtown", name: "Downtown", kind: "downtown", longitude: -76.6122, latitude: 39.2904 },
    { id: "baltimore-harbor", name: "Inner Harbor", kind: "waterfront", longitude: -76.6105, latitude: 39.2851 },
    { id: "baltimore-penn", name: "Penn Station", kind: "transit", longitude: -76.6155, latitude: 39.3075 },
    { id: "baltimore-hopkins", name: "Johns Hopkins", kind: "landmark", longitude: -76.5929, latitude: 39.2970 },
  ],
  "place:4260000": [
    { id: "philly-center", name: "Center City", kind: "downtown", longitude: -75.1652, latitude: 39.9526 },
    { id: "philly-city-hall", name: "City Hall", kind: "landmark", longitude: -75.1636, latitude: 39.9525 },
    { id: "philly-30th", name: "30th Street Station", kind: "transit", longitude: -75.1817, latitude: 39.9556 },
    { id: "philly-university", name: "University City", kind: "district", longitude: -75.1910, latitude: 39.9522 },
  ],
  "place:2622000": [
    { id: "detroit-downtown", name: "Downtown", kind: "downtown", longitude: -83.0458, latitude: 42.3314 },
    { id: "detroit-campus", name: "Campus Martius", kind: "landmark", longitude: -83.0465, latitude: 42.3317 },
    { id: "detroit-central", name: "Michigan Central", kind: "transit", longitude: -83.0779, latitude: 42.3280 },
    { id: "detroit-new-center", name: "New Center", kind: "district", longitude: -83.0720, latitude: 42.3680 },
  ],
  "place:3712000": [
    { id: "charlotte-uptown", name: "Uptown", kind: "downtown", longitude: -80.8431, latitude: 35.2271 },
    { id: "charlotte-stadium", name: "Bank of America Stadium", kind: "landmark", longitude: -80.8533, latitude: 35.2258 },
    { id: "charlotte-south-end", name: "South End", kind: "district", longitude: -80.8570, latitude: 35.2160 },
    { id: "charlotte-noda", name: "NoDa", kind: "district", longitude: -80.8062, latitude: 35.2450 },
  ],
  "place:4513330": [
    { id: "charleston-historic", name: "Historic District", kind: "downtown", longitude: -79.9332, latitude: 32.7765 },
    { id: "charleston-waterfront", name: "Waterfront Park", kind: "waterfront", longitude: -79.9289, latitude: 32.7784 },
    { id: "charleston-market", name: "Charleston City Market", kind: "landmark", longitude: -79.9309, latitude: 32.7807 },
    { id: "charleston-musc", name: "MUSC", kind: "landmark", longitude: -79.9471, latitude: 32.7840 },
  ],
  "place:2507000": [
    { id: "boston-downtown", name: "Downtown", kind: "downtown", longitude: -71.0589, latitude: 42.3601 },
    { id: "boston-south-station", name: "South Station", kind: "transit", longitude: -71.0551, latitude: 42.3523 },
    { id: "boston-back-bay", name: "Back Bay", kind: "district", longitude: -71.0750, latitude: 42.3503 },
    { id: "boston-fenway", name: "Fenway", kind: "landmark", longitude: -71.0972, latitude: 42.3467 },
  ],
  "place:1271000": [
    { id: "tampa-downtown", name: "Downtown", kind: "downtown", longitude: -82.4572, latitude: 27.9506 },
    { id: "tampa-water-street", name: "Water Street", kind: "district", longitude: -82.4510, latitude: 27.9410 },
    { id: "tampa-ybor", name: "Ybor City", kind: "district", longitude: -82.4420, latitude: 27.9640 },
    { id: "tampa-riverwalk", name: "Riverwalk", kind: "waterfront", longitude: -82.4630, latitude: 27.9470 },
  ],
  "place:1714000": [
    { id: "chicago-loop", name: "The Loop", kind: "downtown", longitude: -87.6298, latitude: 41.8781 },
    { id: "chicago-union", name: "Union Station", kind: "transit", longitude: -87.6403, latitude: 41.8786 },
    { id: "chicago-fulton", name: "Fulton Market", kind: "district", longitude: -87.6477, latitude: 41.8867 },
    { id: "chicago-museum", name: "Museum Campus", kind: "landmark", longitude: -87.6170, latitude: 41.8663 },
  ],
};

function rings(area: AreaRecord): number[][][] {
  if (area.geometry.type === "Polygon") return area.geometry.coordinates as number[][][];
  return (area.geometry.coordinates as number[][][][]).flatMap((polygon) => polygon);
}

function boundsFor(areas: AreaRecord[], cityFocused = false): MapBounds {
  const points = areas.flatMap((area) => rings(area).flat());
  if (!points.length) return { west: -77.12, east: -76.9, south: 38.79, north: 39.01 };
  const longitudes = points.map((point) => point[0]);
  const latitudes = points.map((point) => point[1]);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const paddingRatio = cityFocused ? 0.14 : 0.06;
  const longitudePadding = Math.max((east - west) * paddingRatio, 0.015);
  const latitudePadding = Math.max((north - south) * paddingRatio, 0.015);
  return { west: west - longitudePadding, east: east + longitudePadding, south: south - latitudePadding, north: north + latitudePadding };
}

function pathFor(area: AreaRecord, bounds: MapBounds): string {
  const padding = 24;
  const project = ([lon, lat]: Point) => {
    const x = padding + ((lon - bounds.west) / (bounds.east - bounds.west)) * (MAP_WIDTH - padding * 2);
    const y = padding + ((bounds.north - lat) / (bounds.north - bounds.south)) * (MAP_HEIGHT - padding * 2);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };
  return rings(area).map((ring) => `M${ring.map((point) => project(point as Point)).join("L")}Z`).join("");
}

function projectPoint(longitude: number, latitude: number, bounds: MapBounds): Point {
  const padding = 24;
  return [
    padding + ((longitude - bounds.west) / (bounds.east - bounds.west)) * (MAP_WIDTH - padding * 2),
    padding + ((bounds.north - latitude) / (bounds.north - bounds.south)) * (MAP_HEIGHT - padding * 2),
  ];
}

function scoreColor(score: number | null): string {
  if (score === null) return "#cfd3c9";
  if (score >= 75) return "#174f3c";
  if (score >= 60) return "#4d7f61";
  if (score >= 45) return "#93b78f";
  if (score >= 30) return "#d2c593";
  return "#e9d9b6";
}

function floodColor(share: number | undefined): string {
  if (share === undefined) return "#d7d9d2";
  if (share >= 0.5) return "#174c74";
  if (share >= 0.2) return "#2f7399";
  if (share >= 0.05) return "#73aac2";
  if (share > 0) return "#bdd8df";
  return "#edf0ea";
}

function environmentColor(category: string): string {
  if (category === "SUPERFUND") return "#9d2f20";
  if (category === "BROWNFIELD") return "#b8612a";
  if (category === "CONTAMINATION") return "#79548f";
  if (category === "AIR_QUALITY") return "#d19b2d";
  return "#526b65";
}

function zoomBounds(bounds: MapBounds, factor: number, anchor: Point = [MAP_WIDTH / 2, MAP_HEIGHT / 2]): MapBounds {
  const longitudeSpan = bounds.east - bounds.west;
  const latitudeSpan = bounds.north - bounds.south;
  const longitude = bounds.west + (anchor[0] / MAP_WIDTH) * longitudeSpan;
  const latitude = bounds.north - (anchor[1] / MAP_HEIGHT) * latitudeSpan;
  const nextLongitudeSpan = longitudeSpan / factor;
  const nextLatitudeSpan = latitudeSpan / factor;
  const west = longitude - (anchor[0] / MAP_WIDTH) * nextLongitudeSpan;
  const north = latitude + (anchor[1] / MAP_HEIGHT) * nextLatitudeSpan;
  return { west, east: west + nextLongitudeSpan, south: north - nextLatitudeSpan, north };
}

function panBounds(bounds: MapBounds, from: Point, to: Point): MapBounds {
  const longitudeShift = ((to[0] - from[0]) / MAP_WIDTH) * (bounds.east - bounds.west);
  const latitudeShift = ((to[1] - from[1]) / MAP_HEIGHT) * (bounds.north - bounds.south);
  return { west: bounds.west - longitudeShift, east: bounds.east - longitudeShift, south: bounds.south + latitudeShift, north: bounds.north + latitudeShift };
}

export function OpportunityMap({ areas, contextAreas, focusCity, focusLabel, selectedId, hoveredId, comparedIds, loading, onHover, onSelect }: {
  areas: AreaRecord[];
  contextAreas: AreaRecord[];
  focusCity: MarketFocus;
  focusLabel: string;
  selectedId: string | null;
  hoveredId: string | null;
  comparedIds: string[];
  loading: boolean;
  onHover: (areaId: string | null) => void;
  onSelect: (area: AreaRecord) => void;
}) {
  const [layer, setLayer] = useState<MapLayer>("opportunity");
  const [selectedSignal, setSelectedSignal] = useState<SignalPin | null>(null);
  const [developmentPins, setDevelopmentPins] = useState<DevelopmentPin[]>([]);
  const [environmentalPins, setEnvironmentalPins] = useState<EnvironmentalPin[]>([]);
  const [floodByTract, setFloodByTract] = useState<Record<string, number>>({});
  const [layerCount, setLayerCount] = useState({ development: 0, environment: 0, flood: 0 });
  const [signalLoading, setSignalLoading] = useState(false);
  const [showOrientationLabels, setShowOrientationLabels] = useState(true);
  const baseBounds = useMemo(() => boundsFor(contextAreas.length ? contextAreas : areas, focusCity !== "all"), [areas, contextAreas, focusCity]);
  const [bounds, setBounds] = useState(baseBounds);
  const [boxZoomMode, setBoxZoomMode] = useState(false);
  const [zoomBox, setZoomBox] = useState<{ start: Point; end: Point } | null>(null);
  const [hoveredArea, setHoveredArea] = useState<{ area: AreaRecord; point: Point } | null>(null);
  const [activeAreaId, setActiveAreaId] = useState<string | null>(selectedId);
  const evidenceAvailable = focusCity === "place:1150000";
  const svgRef = useRef<SVGSVGElement>(null);
  const mapContentRef = useRef<SVGGElement>(null);
  const dragState = useRef<DragState | null>(null);
  const didPan = useRef(false);
  const wheelFrame = useRef<number | null>(null);
  const pendingWheel = useRef<{ delta: number; point: Point } | null>(null);
  const resultIds = useMemo(() => new Set(areas.map((area) => area.id)), [areas]);
  const visibleContextAreas = useMemo(
    () => contextAreas.filter((area) => !resultIds.has(area.id)),
    [contextAreas, resultIds],
  );
  const geometryNotice = useMemo(() => {
    const renderedAreas = contextAreas.length ? contextAreas : areas;
    const vintages = new Set(renderedAreas.map((area) => area.geometryVintage ?? "2020"));
    const displayCount = renderedAreas.filter((area) => area.geometryVintage === "2025").length;
    if (vintages.size === 1 && vintages.has("2025")) {
      return `Map boundary: 2025 TIGER/Line display geometry (${displayCount} matched tracts)`;
    }
    if (vintages.has("2025")) return "Map boundary: 2025 TIGER/Line where available; 2020 elsewhere";
    return "Map boundary: 2020 Census tract geography";
  }, [areas, contextAreas]);
  const marketCenters = useMemo(
    () => buildMarketCenters(contextAreas.length ? contextAreas : areas),
    [areas, contextAreas],
  );
  const contextPaths = useMemo(
    () => visibleContextAreas.map((area) => ({ area, path: pathFor(area, bounds) })),
    [bounds, visibleContextAreas],
  );
  const areaPaths = useMemo(
    () => areas.map((area) => ({ area, path: pathFor(area, bounds) })),
    [areas, bounds],
  );

  useEffect(() => {
    if (selectedId && areas.some((area) => area.id === selectedId)) {
      setActiveAreaId(selectedId);
    } else if (!activeAreaId || !areas.some((area) => area.id === activeAreaId)) {
      setActiveAreaId(areas[0]?.id ?? null);
    }
  }, [activeAreaId, areas, selectedId]);

  function moveActiveArea(currentId: string, direction: 1 | -1) {
    const currentIndex = areas.findIndex((area) => area.id === currentId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + areas.length) % areas.length;
    const next = areas[nextIndex];
    if (!next) return;
    setActiveAreaId(next.id);
    requestAnimationFrame(() => document.getElementById(`map-area-${next.id}`)?.focus());
  }
  const orientationLabels = useMemo<OrientationLabel[]>(() => {
    if (focusCity !== "all") return MARKET_LANDMARKS[focusCity] ?? [];
    const grouped = new Map<string, { city: string; stateAbbr: string; longitudes: number[]; latitudes: number[] }>();
    for (const area of areas) {
      if (area.longitude === null || area.latitude === null) continue;
      const group = grouped.get(area.marketId) ?? {
        city: area.city,
        stateAbbr: area.stateAbbr,
        longitudes: [],
        latitudes: [],
      };
      group.longitudes.push(area.longitude);
      group.latitudes.push(area.latitude);
      grouped.set(area.marketId, group);
    }
    return [...grouped.entries()].map(([marketId, group]) => ({
      id: `city-${marketId}`,
      name: `${group.city}, ${group.stateAbbr}`,
      kind: "city",
      longitude: group.longitudes.reduce((sum, value) => sum + value, 0) / group.longitudes.length,
      latitude: group.latitudes.reduce((sum, value) => sum + value, 0) / group.latitudes.length,
    }));
  }, [areas, focusCity]);
  const visibleOrientationLabels = useMemo(
    () => orientationLabels.filter((label) =>
      label.longitude >= bounds.west &&
      label.longitude <= bounds.east &&
      label.latitude >= bounds.south &&
      label.latitude <= bounds.north
    ),
    [bounds, orientationLabels],
  );

  useEffect(() => { setBounds(baseBounds); setZoomBox(null); }, [baseBounds]);

  useEffect(() => {
    if (layer === "opportunity") return;
    let cancelled = false;
    setSignalLoading(true);
    fetch(`/api/signals?layer=${layer}&marketId=${encodeURIComponent(focusCity)}&limit=500`)
      .then((response) => response.json())
      .then((payload: { total: number; items: DevelopmentPin[] | EnvironmentalPin[] | Array<{ tractGeoid: string; sfhaAreaShare: number }> }) => {
        if (cancelled) return;
        if (layer === "development") {
          setDevelopmentPins(payload.items as DevelopmentPin[]);
          setLayerCount((counts) => ({ ...counts, development: payload.total }));
        } else if (layer === "environment") {
          setEnvironmentalPins(payload.items as EnvironmentalPin[]);
          setLayerCount((counts) => ({ ...counts, environment: payload.total }));
        } else {
          setFloodByTract(Object.fromEntries((payload.items as Array<{ tractGeoid: string; sfhaAreaShare: number }>).map((item) => [item.tractGeoid, item.sfhaAreaShare])));
          setLayerCount((counts) => ({ ...counts, flood: payload.total }));
        }
        setSignalLoading(false);
      })
      .catch(() => { if (!cancelled) setSignalLoading(false); });
    return () => { cancelled = true; };
  }, [focusCity, layer]);

  function eventPoint(event: { clientX: number; clientY: number }): Point | null {
    const element = svgRef.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return [Math.max(0, Math.min(MAP_WIDTH, ((event.clientX - rect.left) / rect.width) * MAP_WIDTH)), Math.max(0, Math.min(MAP_HEIGHT, ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT))];
  }

  function handleWheel(event: React.WheelEvent<SVGSVGElement>) {
    const point = eventPoint(event);
    if (!point) return;
    event.preventDefault();
    const delta = Math.max(-0.12, Math.min(0.12, -event.deltaY * 0.001));
    pendingWheel.current = { delta, point };
    if (wheelFrame.current !== null) return;
    wheelFrame.current = requestAnimationFrame(() => {
      const pending = pendingWheel.current;
      pendingWheel.current = null;
      wheelFrame.current = null;
      if (pending) setBounds((current) => zoomBounds(current, Math.exp(pending.delta), pending.point));
    });
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const point = eventPoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const boxZoom = boxZoomMode || event.shiftKey;
    dragState.current = { start: point, bounds, boxZoom };
    didPan.current = false;
    if (boxZoom) setZoomBox({ start: point, end: point });
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const point = eventPoint(event);
    const drag = dragState.current;
    if (!point || !drag) return;
    if (Math.abs(point[0] - drag.start[0]) > 3 || Math.abs(point[1] - drag.start[1]) > 3) didPan.current = true;
    if (drag.boxZoom) setZoomBox({ start: drag.start, end: point });
    else mapContentRef.current?.setAttribute(
      "transform",
      `translate(${(point[0] - drag.start[0]).toFixed(1)} ${(point[1] - drag.start[1]).toFixed(1)})`,
    );
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const point = eventPoint(event);
    const drag = dragState.current;
    dragState.current = null;
    mapContentRef.current?.removeAttribute("transform");
    if (!point || !drag) return;
    if (!drag.boxZoom) {
      if (didPan.current) setBounds(panBounds(drag.bounds, drag.start, point));
      return;
    }
    const left = Math.min(drag.start[0], point[0]);
    const top = Math.min(drag.start[1], point[1]);
    const width = Math.abs(drag.start[0] - point[0]);
    const height = Math.abs(drag.start[1] - point[1]);
    setZoomBox(null);
    setBoxZoomMode(false);
    if (width < 14 || height < 14) return;
    setBounds(zoomBounds(drag.bounds, Math.min(MAP_WIDTH / width, MAP_HEIGHT / height), [left, top]));
  }

  const mapLabel = layer === "opportunity" ? "Opportunity score" : layer === "flood" ? "FEMA SFHA tract-area share" : layer === "development" ? `${layerCount.development.toLocaleString()} development-permit candidates` : `${layerCount.environment.toLocaleString()} EPA program-linked facilities`;

  return (
    <div className="map-wrap">
      <div className="map-controls" aria-label="Map controls">
        <div className="map-zoom-controls" aria-label="Map navigation">
          <button aria-label="Zoom in" onClick={() => setBounds((current) => zoomBounds(current, 1.2))} title="Zoom in">+</button>
          <button aria-label="Zoom out" onClick={() => setBounds((current) => zoomBounds(current, 1 / 1.2))} title="Zoom out">−</button>
          <button aria-label="Fit filtered results" onClick={() => setBounds(boundsFor(areas.length ? areas : contextAreas, focusCity !== "all"))} title="Fit filtered results">Fit results</button>
          <button aria-label="Reset map view" onClick={() => setBounds(baseBounds)} title="Reset map view">Reset</button>
          <button aria-pressed={boxZoomMode} className={boxZoomMode ? "active" : ""} onClick={() => setBoxZoomMode((active) => !active)} title="Highlight an area to zoom in">Box zoom</button>
          <button
            aria-pressed={showOrientationLabels}
            className={showOrientationLabels ? "active" : ""}
            onClick={() => setShowOrientationLabels((active) => !active)}
            title="Show or hide city, downtown, district, transit, and landmark labels"
          >
            Labels
          </button>
        </div>
        <span className="map-control-divider" aria-hidden="true" />
        {([ ["opportunity", "Opportunity"], ["development", "Development"], ["flood", "Flood"], ["environment", "EPA facilities"] ] as const).map(([value, label]) => (
          <button aria-describedby={!evidenceAvailable && value !== "opportunity" ? "map-evidence-coverage" : undefined} className={layer === value ? "active" : ""} disabled={!evidenceAvailable && value !== "opportunity"} key={value} onClick={() => { setLayer(value); setSelectedSignal(null); }}>{label}</button>
        ))}
      </div>
      <div className="map-note">
        {signalLoading ? "Loading evidence layer..." : mapLabel} / {geometryNotice}
        {` / ${focusLabel}`}
        <span>Metrics retain their source geography: ACS values use 2020 Census tracts.</span>
        {layer === "opportunity" ? "" : " / DC evidence only"}
        {!evidenceAvailable ? <span id="map-evidence-coverage">Development, flood, and EPA layers are not available for this market.</span> : null}
        <span>Scroll to zoom; drag to pan; choose Box zoom (or hold Shift) and highlight an area.</span>
      </div>
      {loading && !areas.length ? (
        <div className="map-loading" role="status">
          <span />
          <strong>Preparing the opportunity map</strong>
          <small>Loading boundaries and opportunity scores…</small>
        </div>
      ) : contextAreas.length || areas.length ? (
        <svg
          className="map-svg"
          ref={svgRef}
          viewBox="0 0 800 520"
          role="img"
          aria-label={`Map of ${areas.length} filtered census tracts in ${focusLabel} with surrounding tract context`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          <g ref={mapContentRef}>
          <g aria-hidden="true">{contextPaths.map(({ area, path }) => <path className="map-context-area" d={path} key={`context-${area.id}`} />)}</g>
          {areaPaths.map(({ area, path }) => (
            <path
              aria-label={layer === "flood" ? `${investorAreaName(area, marketCenters[area.marketId])}, special flood hazard area share ${floodByTract[area.id] ?? "not available"}` : `${investorAreaName(area, marketCenters[area.marketId])}, opportunity score ${area.score ?? "not available"}`}
              className={`map-area ${selectedId === area.id ? "selected" : ""} ${hoveredId === area.id ? "hovered" : ""} ${comparedIds.includes(area.id) ? "compared" : ""}`}
              d={path}
              fill={layer === "flood" ? floodColor(floodByTract[area.id]) : layer === "opportunity" ? scoreColor(area.score) : "#e8ece5"}
              key={area.id}
              id={`map-area-${area.id}`}
              onClick={() => { if (didPan.current) { didPan.current = false; return; } onSelect(area); }}
              onDoubleClick={() => window.location.assign(`/areas/${area.id}`)}
              onPointerEnter={(event) => {
                const point = eventPoint(event);
                if (point) {
                  setHoveredArea({ area, point });
                  onHover(area.id);
                }
              }}
              onPointerLeave={() => {
                setHoveredArea((current) => current?.area.id === area.id ? null : current);
                onHover(null);
              }}
              onPointerMove={(event) => {
                const point = eventPoint(event);
                if (point && !dragState.current) setHoveredArea({ area, point });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(area);
                } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  moveActiveArea(area.id, 1);
                } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  moveActiveArea(area.id, -1);
                }
              }}
              onFocus={() => setActiveAreaId(area.id)}
              opacity={selectedId && selectedId !== area.id ? 0.67 : 0.95}
              role="button"
              tabIndex={activeAreaId === area.id ? 0 : -1}
            />
          ))}
          {layer === "development" ? developmentPins.map((pin) => {
            const [cx, cy] = projectPoint(pin.longitude, pin.latitude, bounds);
            const selectPin = () => setSelectedSignal({ kind: "development" as const, item: pin });
            return (
              <circle
                aria-label={`${pin.permitType ?? "Development permit"} at ${pin.address}`}
                className="signal-point development-point"
                cx={cx}
                cy={cy}
                key={pin.id}
                onClick={selectPin}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectPin();
                  }
                }}
                r={2.35}
                role="button"
                tabIndex={-1}
              />
            );
          }) : null}
          {layer === "environment" ? environmentalPins.map((pin) => {
            const [cx, cy] = projectPoint(pin.longitude, pin.latitude, bounds);
            const selectPin = () => setSelectedSignal({ kind: "environment" as const, item: pin });
            return (
              <circle
                aria-label={`${pin.category} context: ${pin.name}`}
                className="signal-point environmental-point"
                cx={cx}
                cy={cy}
                fill={environmentColor(pin.category)}
                key={pin.id}
                onClick={selectPin}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectPin();
                  }
                }}
                r={1.55}
                role="button"
                tabIndex={-1}
              />
            );
          }) : null}
          {showOrientationLabels ? visibleOrientationLabels.map((label, index) => {
            const [rawX, rawY] = projectPoint(label.longitude, label.latitude, bounds);
            const width = Math.min(132, Math.max(62, label.name.length * 6.2 + 20));
            const x = Math.min(MAP_WIDTH - width - 8, Math.max(8, rawX + (index % 2 ? 7 : -width - 7)));
            const y = Math.min(MAP_HEIGHT - 39, Math.max(8, rawY - 16));
            return (
              <g className={`map-orientation-label ${label.kind}`} key={label.id} pointerEvents="none">
                <circle cx={rawX} cy={rawY} r={label.kind === "city" || label.kind === "downtown" ? 4.5 : 3.5} />
                <rect height="34" rx="7" width={width} x={x} y={y} />
                <text x={x + 9} y={y + 14}>{label.name}</text>
                <text className="map-orientation-kind" x={x + 9} y={y + 26}>
                  {label.kind === "city" ? "integrated market" : label.kind}
                </text>
              </g>
            );
          }) : null}
          </g>
          {zoomBox ? <rect className="map-zoom-box" height={Math.abs(zoomBox.end[1] - zoomBox.start[1])} width={Math.abs(zoomBox.end[0] - zoomBox.start[0])} x={Math.min(zoomBox.start[0], zoomBox.end[0])} y={Math.min(zoomBox.start[1], zoomBox.end[1])} /> : null}
        </svg>
      ) : <div className="map-svg" role="status">No tract boundaries match these filters.</div>}
      {hoveredArea ? (
        <div
          className="map-hover-card"
          style={{
            left: `${Math.min(70, Math.max(2, (hoveredArea.point[0] / MAP_WIDTH) * 100))}%`,
            top: `${Math.min(72, Math.max(12, (hoveredArea.point[1] / MAP_HEIGHT) * 100))}%`,
          }}
        >
          <small>{hoveredArea.area.neighborhood ? "Neighborhood" : "Area"}</small>
          <strong>{investorAreaName(hoveredArea.area, marketCenters[hoveredArea.area.marketId])}</strong>
          <span>{hoveredArea.area.city}, {hoveredArea.area.stateAbbr} · {hoveredArea.area.tractLabel}</span>
          <div><span>Opportunity score</span><b>{hoveredArea.area.score?.toFixed(0) ?? "Not available"}</b></div>
          <div><span>Population</span><b>{hoveredArea.area.metrics.population?.toLocaleString() ?? "Not available"}</b></div>
          <div><span>Population growth</span><b>{formatPercent(hoveredArea.area.metrics.populationGrowth, true)}</b></div>
          <div><span>Income</span><b>{formatCurrency(hoveredArea.area.metrics.medianHouseholdIncome)}</b></div>
          <div><span>Data quality</span><b>{formatPercent(hoveredArea.area.metrics.metricCoverage)}</b></div>
        </div>
      ) : null}
      {layer === "opportunity" || layer === "flood" ? <div className="map-legend" aria-label={`${mapLabel} legend`}>{mapLabel}<div className={`legend-gradient ${layer === "flood" ? "flood-gradient" : ""}`} /><div className="legend-labels"><span>Lower</span><span>Higher</span></div></div> : null}
      {selectedSignal ? <div className="map-popup"><button aria-label="Close evidence detail" onClick={() => setSelectedSignal(null)}>×</button><small>{selectedSignal.kind === "development" ? "Permit candidate" : selectedSignal.item.category.replaceAll("_", " ")}</small><strong>{selectedSignal.kind === "development" ? selectedSignal.item.address : selectedSignal.item.name}</strong><span>{selectedSignal.kind === "development" ? `${selectedSignal.item.permitType ?? "Permit"} / ${selectedSignal.item.issueDate ?? "date unavailable"}` : selectedSignal.item.programCodes || "EPA program codes unavailable"}</span><a href={selectedSignal.item.sourceUrl} target="_blank" rel="noreferrer">Open official source</a></div> : null}
    </div>
  );
}
