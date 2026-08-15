import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { properties, savedProperties } from "../../../db/schema";
import { deriveProperty } from "../../lib/property-domain";
import { requestUserEmail } from "../../lib/request-user";

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureSchema();
  const db = await getDb();
  const rows = await db
    .select({ saved: savedProperties, property: properties })
    .from(savedProperties)
    .innerJoin(properties, eq(savedProperties.propertyId, properties.id))
    .where(and(eq(savedProperties.userEmail, email), eq(properties.userEmail, email)))
    .orderBy(desc(savedProperties.createdAt));
  return Response.json({
    items: rows.map(({ saved, property }) => ({
      ...saved,
      property: { ...property, derived: deriveProperty(property) },
    })),
  });
}

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as { propertyId?: unknown };
  const propertyId = Number(body.propertyId);
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return Response.json({ error: "A valid propertyId is required." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  const [property] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.userEmail, email)))
    .limit(1);
  if (!property) return Response.json({ error: "Property not found." }, { status: 404 });
  await db.insert(savedProperties).values({ userEmail: email, propertyId }).onConflictDoNothing();
  return Response.json({ saved: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const propertyId = Number(new URL(request.url).searchParams.get("propertyId"));
  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    return Response.json({ error: "A valid propertyId is required." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  await db
    .delete(savedProperties)
    .where(
      and(
        eq(savedProperties.userEmail, email),
        eq(savedProperties.propertyId, propertyId),
      ),
    );
  return new Response(null, { status: 204 });
}
