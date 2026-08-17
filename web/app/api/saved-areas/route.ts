import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { savedAreas } from "../../../db/schema";
import { getArea } from "../../lib/areas";
import { requestUserEmail } from "../../lib/request-user";

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureSchema();
  const db = await getDb();
  const rows = await db
    .select()
    .from(savedAreas)
    .where(eq(savedAreas.userEmail, email))
    .orderBy(desc(savedAreas.createdAt));
  const items = (await Promise.all(rows.map(async (row) => {
    const area = await getArea(row.areaId);
    return area ? { ...row, area } : null;
  }))).filter((item): item is NonNullable<typeof item> => item !== null);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as { areaId?: unknown };
  const areaId = typeof body.areaId === "string" ? body.areaId.trim() : "";
  if (!areaId || !(await getArea(areaId))) {
    return Response.json({ error: "A supported areaId is required" }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  await db.insert(savedAreas).values({ userEmail: email, areaId }).onConflictDoNothing();
  const [saved] = await db
    .select()
    .from(savedAreas)
    .where(and(eq(savedAreas.userEmail, email), eq(savedAreas.areaId, areaId)))
    .limit(1);
  return Response.json({ item: saved }, { status: 201 });
}

export async function DELETE(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const areaId = new URL(request.url).searchParams.get("areaId")?.trim() ?? "";
  if (!areaId) return Response.json({ error: "areaId is required" }, { status: 400 });
  await ensureSchema();
  const db = await getDb();
  await db
    .delete(savedAreas)
    .where(and(eq(savedAreas.userEmail, email), eq(savedAreas.areaId, areaId)));
  return new Response(null, { status: 204 });
}
