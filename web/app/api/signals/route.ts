import { phase8 } from "../../lib/phase8";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const layer = search.get("layer") ?? "summary";
  const marketId = search.get("marketId") ?? "";
  const requestedLimit = Number(search.get("limit") ?? "100");
  const limit = Math.min(5000, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 100));
  const developmentMarketId = (pin: typeof phase8.developmentPins[number]) => pin.marketId ?? "place:1150000";
  const developmentAvailable = new Set(phase8.developmentPins.map(developmentMarketId));
  if (layer === "development" && !developmentAvailable.has(marketId)) {
    return Response.json({
      generatedAt: phase8.generatedAt,
      layer,
      total: 0,
      items: [],
      coverage: "This evidence layer is not yet ingested for the selected market.",
    });
  }

  if (layer === "development") {
    return Response.json({
      generatedAt: phase8.generatedAt,
      layer,
      total: phase8.developmentPins.filter((pin) => developmentMarketId(pin) === marketId).length,
      items: phase8.developmentPins.filter((pin) => developmentMarketId(pin) === marketId).slice(0, limit),
      evidenceRule: phase8.evidenceRules.development,
    });
  }
  if (layer === "environment") {
    return Response.json({
      generatedAt: phase8.generatedAt,
      layer,
      total: phase8.environmentalPins.length,
      items: phase8.environmentalPins.slice(0, limit),
      evidenceRule: phase8.evidenceRules.environment,
    });
  }
  if (layer === "flood") {
    return Response.json({
      generatedAt: phase8.generatedAt,
      layer,
      total: Object.keys(phase8.floodByTract).length,
      items: Object.entries(phase8.floodByTract)
        .slice(0, limit)
        .map(([tractGeoid, sfhaAreaShare]) => ({ tractGeoid, sfhaAreaShare })),
      evidenceRule: phase8.evidenceRules.flood,
    });
  }
  if (layer === "regulation") {
    return Response.json({
      generatedAt: phase8.generatedAt,
      layer,
      total: phase8.policies.length,
      items: phase8.policies.slice(0, limit),
      evidenceRule: phase8.evidenceRules.regulation,
    });
  }
  return Response.json({
    generatedAt: phase8.generatedAt,
    coverage: phase8.coverage,
    layers: ["development", "environment", "flood", "regulation"],
    usage: "Pass ?layer=<name>&limit=<1-5000> for evidence records.",
  });
}
