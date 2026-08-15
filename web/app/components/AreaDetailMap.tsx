import type { AreaRecord } from "../lib/types";

function collectRings(area: AreaRecord): number[][][] {
  return area.geometry.type === "Polygon"
    ? (area.geometry.coordinates as number[][][])
    : (area.geometry.coordinates as number[][][][]).flatMap((polygon) => polygon);
}

export function AreaDetailMap({ area }: { area: AreaRecord }) {
  const rings = collectRings(area);
  const points = rings.flat();
  const west = Math.min(...points.map((point) => point[0]));
  const east = Math.max(...points.map((point) => point[0]));
  const south = Math.min(...points.map((point) => point[1]));
  const north = Math.max(...points.map((point) => point[1]));
  const width = Math.max(0.0001, east - west);
  const height = Math.max(0.0001, north - south);
  const path = rings
    .map((ring) =>
      `M${ring.map(([lon, lat]) => {
        const x = 30 + ((lon - west) / width) * 540;
        const y = 20 + ((north - lat) / height) * 250;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join("L")}Z`,
    )
    .join("");
  return (
    <svg className="trend-chart" viewBox="0 0 600 290" role="img" aria-label={`${area.name} tract boundary`}>
      <path d={path} fill="#9abd98" stroke="#174f3c" strokeWidth="2" />
    </svg>
  );
}
