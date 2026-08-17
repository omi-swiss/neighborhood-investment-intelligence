import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/initialize";
import { properties } from "../../../../db/schema";
import { csvCell } from "../../../lib/csv";
import { deriveProperty } from "../../../lib/property-domain";
import { requestUserEmail } from "../../../lib/request-user";

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureSchema();
  const db = await getDb();
  const rows = await db.select().from(properties).where(eq(properties.userEmail, email));
  const headers = [
    "property_id", "source_record_id", "address", "city", "county", "state", "postal_code",
    "property_type", "unit_count", "asking_price", "building_square_feet",
    "market_monthly_rent", "gross_yield", "cap_rate_proxy", "favorability_status",
    "favorability_score", "data_completeness", "tract_geoid", "source_name",
    "source_license", "source_url", "observed_at",
  ];
  const lines = await Promise.all(rows.map(async (property) => {
    const derived = await deriveProperty(property);
    return [
      property.id, property.sourceRecordId, property.address, property.city, property.county,
      property.state, property.postalCode, property.propertyType, property.unitCount,
      property.askingPrice, property.buildingSquareFeet, property.marketMonthlyRent,
      derived.grossYield, derived.capRateProxy, derived.favorabilityStatus,
      derived.favorabilityScore, derived.dataCompleteness, property.tractGeoid,
      property.sourceName, property.sourceLicense, property.sourceUrl, property.observedAt,
    ].map(csvCell).join(",");
  }));
  return new Response([headers.join(","), ...lines].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nii-property-marketplace.csv"',
      "Cache-Control": "private, max-age=30",
    },
  });
}
