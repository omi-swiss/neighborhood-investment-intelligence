import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { properties } from "../../../db/schema";
import { deriveProperty } from "../../lib/property-domain";
import { requestUserEmail } from "../../lib/request-user";

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const search = new URL(request.url).searchParams;
  const query = (search.get("search") ?? "").trim().toLowerCase();
  const city = (search.get("city") ?? "").trim().toLowerCase();
  const propertyType = search.get("propertyType") ?? "";
  const minimumPrice = Number(search.get("minimumPrice") ?? 0);
  const maximumPrice = Number(search.get("maximumPrice") ?? Number.MAX_SAFE_INTEGER);
  const minimumGrossYield = Number(search.get("minimumGrossYield") ?? 0);
  const minimumCompleteness = Number(search.get("minimumCompleteness") ?? 0);
  const requestedPage = Number(search.get("page") ?? 1);
  const requestedPageSize = Number(search.get("pageSize") ?? 24);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize =
    Number.isInteger(requestedPageSize) && requestedPageSize > 0
      ? Math.min(requestedPageSize, 100)
      : 24;
  await ensureSchema();
  const db = await getDb();
  const rows = await db
    .select()
    .from(properties)
    .where(eq(properties.userEmail, email))
    .orderBy(desc(properties.updatedAt));
  const filtered = rows
    .map((property) => ({ ...property, derived: deriveProperty(property) }))
    .filter((property) => {
      const haystack = [
        property.address,
        property.city,
        property.county,
        property.state,
        property.postalCode,
        property.sourceRecordId,
      ].join(" ").toLowerCase();
      return (
        (!query || haystack.includes(query)) &&
        (!city || property.city.toLowerCase() === city) &&
        (!propertyType || property.propertyType === propertyType) &&
        property.askingPrice >= (Number.isFinite(minimumPrice) ? minimumPrice : 0) &&
        property.askingPrice <= (Number.isFinite(maximumPrice) ? maximumPrice : Number.MAX_SAFE_INTEGER) &&
        ((!Number.isFinite(minimumGrossYield) || minimumGrossYield <= 0) ||
          (property.derived.grossYield !== null &&
            property.derived.grossYield >= minimumGrossYield)) &&
        property.derived.dataCompleteness >=
          (Number.isFinite(minimumCompleteness) ? minimumCompleteness : 0)
      );
    });
  const start = (page - 1) * pageSize;
  return Response.json({
    items: filtered.slice(start, start + pageSize),
    mapItems: filtered.filter((property) => property.latitude !== null && property.longitude !== null),
    total: filtered.length,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
}
