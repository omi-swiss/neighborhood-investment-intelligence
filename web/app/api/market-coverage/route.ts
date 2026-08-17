import { remainingGaps } from "../../lib/remaining-gaps";
import { loadDataset } from "../../lib/areas";

export async function GET(request: Request) {
  const dataset = await loadDataset();
  const search = new URL(request.url).searchParams;
  const resource = search.get("resource") ?? "markets";
  const requestedLimit = Number(search.get("limit") ?? "100");
  const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 100));

  if (resource === "public-investment") {
    return Response.json({
      generatedAt: remainingGaps.generatedAt,
      total: remainingGaps.coverage.publicInvestmentCandidateCount,
      items: remainingGaps.publicInvestmentCandidates.slice(0, limit),
      interpretation: "Discovery candidates only. Award place of performance is not a project coordinate.",
    });
  }

  if (resource === "qualified-sales") {
    return Response.json({
      generatedAt: remainingGaps.generatedAt,
      total: remainingGaps.coverage.recentQualifiedSaleCount,
      items: remainingGaps.recentQualifiedSales.slice(0, limit),
      interpretation: remainingGaps.marketplaceContract.publicRecords,
    });
  }

  return Response.json({
    generatedAt: dataset.generatedAt,
    total: dataset.markets.length,
    items: dataset.markets,
    rolloutNotes: remainingGaps.markets,
    marketplaceContract: remainingGaps.marketplaceContract,
    usage: "Pass ?resource=public-investment or ?resource=qualified-sales for compact evidence samples.",
  });
}
