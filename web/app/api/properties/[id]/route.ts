import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/initialize";
import { properties, propertyListingHistory } from "../../../../db/schema";
import { deriveProperty } from "../../../lib/property-domain";
import { requestUserEmail } from "../../../lib/request-user";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "A valid property id is required." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.userEmail, email), eq(properties.id, id)))
    .limit(1);
  if (!property) return Response.json({ error: "Property not found." }, { status: 404 });
  const history = await db
    .select()
    .from(propertyListingHistory)
    .where(
      and(
        eq(propertyListingHistory.userEmail, email),
        eq(propertyListingHistory.propertyId, property.id),
      ),
    )
    .orderBy(desc(propertyListingHistory.observedAt))
    .limit(100);
  return Response.json({ item: { ...property, derived: await deriveProperty(property) }, history });
}
