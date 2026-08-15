import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { alerts } from "../../../db/schema";
import { ALERT_EVENT_TYPES } from "../../lib/monitoring";
import { requestUserEmail } from "../../lib/request-user";

function parse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const unreadOnly = params.get("unread") === "1";
  const eventType = params.get("eventType") ?? "";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  if (eventType && !(ALERT_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return Response.json({ error: "Unsupported event type." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  const conditions = [eq(alerts.userEmail, email)];
  if (unreadOnly) conditions.push(isNull(alerts.readAt));
  if (eventType) conditions.push(eq(alerts.eventType, eventType));
  const rows = await db
    .select()
    .from(alerts)
    .where(and(...conditions))
    .orderBy(desc(alerts.detectedAt))
    .limit(limit);
  const unread = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(and(eq(alerts.userEmail, email), isNull(alerts.readAt)));
  return Response.json({
    items: rows.map((row) => ({
      ...row,
      previous: parse(row.previousJson),
      current: parse(row.currentJson) ?? {},
    })),
    unreadCount: unread.length,
  });
}

export async function PATCH(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as { id?: unknown; all?: unknown };
  const id = Number(body.id);
  const now = new Date().toISOString();
  await ensureSchema();
  const db = await getDb();
  if (body.all === true) {
    await db
      .update(alerts)
      .set({ readAt: now })
      .where(and(eq(alerts.userEmail, email), isNull(alerts.readAt)));
    return Response.json({ updated: true });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "A valid alert id is required." }, { status: 400 });
  }
  const [item] = await db
    .update(alerts)
    .set({ readAt: now })
    .where(and(eq(alerts.userEmail, email), eq(alerts.id, id)))
    .returning();
  if (!item) return Response.json({ error: "Alert not found." }, { status: 404 });
  return Response.json({ item });
}
