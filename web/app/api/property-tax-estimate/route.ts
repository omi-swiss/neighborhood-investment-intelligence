import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { properties } from "../../../db/schema";
import { requestUserEmail } from "../../lib/request-user";

export async function POST(request: Request) {
  const body = await request.json() as { propertyId?: number | null; purchasePrice?: number };
  if (!body.propertyId) {
    return Response.json({
      status: "unavailable",
      message:
        "A parcel-linked property record is required for a defensible tax estimate. Enter the current annual tax manually or import an authorized property record; a generic city rate was not substituted.",
    }, { status: 422 });
  }
  const email = requestUserEmail(request);
  if (!email) {
    return Response.json({
      status: "unavailable",
      message: "Sign in to load tax evidence from a saved property record.",
    }, { status: 401 });
  }
  try {
    await ensureSchema();
    const db = await getDb();
    const [property] = await db
      .select({ annualPropertyTaxes: properties.annualPropertyTaxes })
      .from(properties)
      .where(and(eq(properties.id, body.propertyId), eq(properties.userEmail, email)))
      .limit(1);
    if (typeof property?.annualPropertyTaxes === "number") {
      return Response.json({
        status: "observed",
        annualTax: property.annualPropertyTaxes,
        message: "Loaded annual property tax from the authorized property record.",
      });
    }
  } catch {
    // Return the same source-safe unavailability state below.
  }
  return Response.json({
    status: "unavailable",
    message:
      "The selected property has no verified annual tax record. Enter the current bill manually; no jurisdiction average was substituted.",
  }, { status: 422 });
}
