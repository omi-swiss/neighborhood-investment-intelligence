import { filterAreas, getMapContextAreas } from "../../lib/areas";
import { filtersFromSearch } from "../../lib/screener-query";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const filters = filtersFromSearch(search);
  const page = Math.max(1, Math.floor(Number(search.get("page")) || 1));
  const pageSize = Math.min(
    50,
    Math.max(10, Math.floor(Number(search.get("pageSize")) || 20)),
  );
  const areas = filterAreas(filters);
  const pageStart = (page - 1) * pageSize;

  return Response.json(
    {
      items: areas.slice(pageStart, pageStart + pageSize),
      mapItems: areas.slice(0, 5000),
      mapContextItems: getMapContextAreas(filters.city),
      total: areas.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(areas.length / pageSize)),
      filters,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30",
        "X-Data-Release": "acs-2023-supported-market-cohort",
      },
    },
  );
}
