import { filterAreas } from "../../lib/areas";
import type { MarketMapSummary } from "../../lib/types";
import { filtersFromSearch } from "../../lib/screener-query";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const filters = filtersFromSearch(search);
  const page = Math.max(1, Math.floor(Number(search.get("page")) || 1));
  const pageSize = Math.min(
    50,
    Math.max(10, Math.floor(Number(search.get("pageSize")) || 20)),
  );
  const areas = await filterAreas(filters);
  const pageStart = (page - 1) * pageSize;
  const mapLimit = 1_200;
  const marketSummaries: MarketMapSummary[] = filters.city === "all"
    ? [...areas.reduce((summaries, area) => {
      if (area.latitude === null || area.longitude === null) return summaries;
      const current = summaries.get(area.marketId) ?? {
        marketId: area.marketId,
        city: area.city,
        stateAbbr: area.stateAbbr,
        latitude: 0,
        longitude: 0,
        tractCount: 0,
        scoreTotal: 0,
        scoredCount: 0,
      };
      current.latitude += area.latitude;
      current.longitude += area.longitude;
      current.tractCount += 1;
      if (area.score !== null) { current.scoreTotal += area.score; current.scoredCount += 1; }
      summaries.set(area.marketId, current);
      return summaries;
    }, new Map<string, { marketId: string; city: string; stateAbbr: string; latitude: number; longitude: number; tractCount: number; scoreTotal: number; scoredCount: number }>()).values()].map((market) => ({
      marketId: market.marketId,
      city: market.city,
      stateAbbr: market.stateAbbr,
      latitude: market.latitude / market.tractCount,
      longitude: market.longitude / market.tractCount,
      tractCount: market.tractCount,
      averageScore: market.scoredCount ? Math.round((market.scoreTotal / market.scoredCount) * 10) / 10 : null,
    }))
    : [];
  const mapItems = filters.city === "all" ? [] : areas.slice(0, mapLimit);

  return Response.json(
    {
      items: areas.slice(pageStart, pageStart + pageSize),
      mapItems,
      marketSummaries,
      mapTotal: filters.city === "all" ? areas.length : areas.length,
      mapTruncated: filters.city !== "all" && areas.length > mapItems.length,
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
