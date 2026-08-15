import { propertyMarketDirectory } from "../../data/property-markets";
import { remainingGaps } from "../../lib/remaining-gaps";
import { lookupOfficialProperties, PUBLIC_PROPERTY_PAGE_SIZE } from "../../lib/public-property-connectors";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const market = (search.get("market") ?? "all").trim();
  const query = (search.get("search") ?? "").trim().toLowerCase();
  const view = search.get("view") === "properties" ? "properties" : "sales";
  const requestedYears = search.get("years") ?? "5";
  const years = requestedYears === "all" ? "all" : [1, 3, 5, 10].includes(Number(requestedYears))
    ? Number(requestedYears)
    : 5;
  const requestedPage = Number(search.get("page") ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = PUBLIC_PROPERTY_PAGE_SIZE;
  const selectedMarket = propertyMarketDirectory.find((item) => item.id === market);
  const cutoff = years === "all" ? null : (() => {
    const date = new Date();
    date.setUTCFullYear(date.getUTCFullYear() - years);
    return date.toISOString().slice(0, 10);
  })();

  const withinSaleWindow = (sale: (typeof remainingGaps.recentQualifiedSales)[number]) => {
    if (view === "properties") return true;
    if (!sale.saleDate) return false;
    return !cutoff || sale.saleDate >= cutoff;
  };

  const coverage = propertyMarketDirectory.map((item) => ({
    ...item,
    recordCount: remainingGaps.coverage.propertyMarkets[item.city]?.recordCount ?? null,
    latestRecordDate: remainingGaps.coverage.propertyMarkets[item.city]?.latestSaleDate ?? null,
  }));

  if (selectedMarket?.recordCoverage === "live-official") {
    if (query.length < 3) {
      return Response.json({
        items: [],
        total: 0,
        page,
        pageSize,
        pageCount: 1,
        market: selectedMarket,
        coverage,
        lookupStatus: "search-required",
        message: `Enter at least three characters from an address, parcel ID, or ${selectedMarket.city} location.`,
        source: { name: selectedMarket.officialSourceName, url: selectedMarket.officialSourceUrl },
      });
    }
    try {
      const live = await lookupOfficialProperties(selectedMarket, query, page);
      const items = live.items.filter(withinSaleWindow);
      const hasParcelMatchesWithoutRecentSales = view === "sales" && live.items.length > 0 && items.length === 0;
      return Response.json({
        items,
        total: view === "sales" ? items.length : live.total,
        page,
        pageSize,
        pageCount: view === "sales" ? 1 : Math.max(1, Math.ceil(live.total / pageSize)),
        totalIsLowerBound: view === "properties" && Boolean(live.totalIsLowerBound),
        market: selectedMarket,
        coverage,
        lookupStatus: "live",
        message: items.length
          ? view === "sales"
            ? `Recorded sales ${cutoff ? `since ${cutoff}` : "from all available years"} from ${live.sourceName}.`
            : `Live property records from ${live.sourceName}.`
          : hasParcelMatchesWithoutRecentSales
            ? `Properties matched, but none include a recorded sale ${cutoff ? `since ${cutoff}` : "date"}. Try All properties.`
          : `No ${selectedMarket.city} parcel records matched that search.`,
        source: { name: live.sourceName, url: live.sourceUrl },
      }, {
        headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" },
      });
    } catch {
      return Response.json({
        items: [],
        total: 0,
        page,
        pageSize,
        pageCount: 1,
        market: selectedMarket,
        coverage,
        lookupStatus: "temporarily-unavailable",
        message: `${selectedMarket.officialSourceName} did not respond in time. Open the official search or retry.`,
        source: { name: selectedMarket.officialSourceName, url: selectedMarket.officialSourceUrl },
      });
    }
  }

  const filtered = remainingGaps.recentQualifiedSales.filter((sale) => {
    const marketMatches = !selectedMarket || sale.city === selectedMarket.city;
    const haystack = [
      sale.address,
      sale.city,
      sale.state,
      sale.neighborhood,
      sale.tractGeoid,
      sale.parcelId,
      sale.propertyType,
    ].filter(Boolean).join(" ").toLowerCase();
    return marketMatches && withinSaleWindow(sale) && (!query || haystack.includes(query));
  });
  const start = (page - 1) * pageSize;

  return Response.json({
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
    market: selectedMarket ?? null,
    coverage,
    lookupStatus: "snapshot",
    totalIsLowerBound: false,
    message: selectedMarket
      ? view === "sales"
        ? `Verified ${years === "all" ? "recorded-sale history" : `${years}-year recorded-sale snapshot`} for ${selectedMarket.city}.`
        : `Available indexed property records for ${selectedMarket.city}.`
      : view === "sales"
        ? `${years === "all" ? "All available" : `Past ${years} years of`} verified recorded sales. Choose a live market to search its official system.`
        : "Available indexed property records across snapshot markets. Choose a live market to search its official parcel system.",
    source: selectedMarket
      ? { name: selectedMarket.officialSourceName, url: selectedMarket.officialSourceUrl }
      : null,
  });
}
