import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { alertRules } from "../../../db/schema";
import {
  ALERT_EVENT_TYPES,
  type AlertEventType,
} from "../../lib/monitoring";
import { requestUserEmail } from "../../lib/request-user";

export async function PATCH(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as {
    entityType?: unknown;
    entityKey?: unknown;
    eventTypes?: unknown;
    enabled?: unknown;
  };
  const entityType = typeof body.entityType === "string" ? body.entityType : "";
  const entityKey = typeof body.entityKey === "string" ? body.entityKey : "";
  const rawEventTypes = Array.isArray(body.eventTypes) ? body.eventTypes : null;
  const eventTypes = rawEventTypes
    ? rawEventTypes.filter(
        (value): value is AlertEventType =>
          typeof value === "string" &&
          (ALERT_EVENT_TYPES as readonly string[]).includes(value),
      )
    : null;
  if (!entityType || !entityKey || !eventTypes || eventTypes.length !== rawEventTypes?.length) {
    return Response.json({ error: "A valid entity and eventTypes array are required." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.userEmail, email),
        eq(alertRules.entityType, entityType),
        eq(alertRules.entityKey, entityKey),
      ),
    )
    .limit(1);
  if (!existing) return Response.json({ error: "Alert rule not found." }, { status: 404 });
  const [item] = await db
    .update(alertRules)
    .set({
      eventTypesJson: JSON.stringify([...new Set(eventTypes)]),
      enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(alertRules.id, existing.id))
    .returning();
  return Response.json({ item: { ...item, eventTypes: JSON.parse(item.eventTypesJson) } });
}
