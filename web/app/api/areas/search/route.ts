import { dataset } from "../../../lib/areas";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (query.length < 2) return Response.json({ items: [] });

  const contexts = dataset.markets.map((market) => ({
    id: market.id,
    level: market.geographyType,
    name: market.label,
    context: market.enabled
      ? `${market.areaCount} comparable tracts · integrated`
      : "Definition retained; tract cohort is planned and not selectable",
  }));
  return Response.json({
    items: contexts.filter((item) =>
      `${item.name} ${item.context}`.toLowerCase().includes(query),
    ),
  });
}
