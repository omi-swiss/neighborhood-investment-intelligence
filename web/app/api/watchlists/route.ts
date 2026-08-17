import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { alertRules, properties, watchlistItems, watchlists } from "../../../db/schema";
import { getArea } from "../../lib/areas";
import { loadDataset } from "../../lib/areas";
import {
  areaSnapshot,
  defaultEventsByEntity,
  propertySnapshot,
  type MonitoredEntityType,
} from "../../lib/monitoring";
import { deriveProperty } from "../../lib/property-domain";
import { requestUserEmail } from "../../lib/request-user";

type WatchlistBody = {
  name?: unknown;
  description?: unknown;
  watchlistId?: unknown;
  entityType?: unknown;
  entityKey?: unknown;
};

function parsedJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureSchema();
  const db = await getDb();
  const [lists, items, rules] = await Promise.all([
    db.select().from(watchlists).where(eq(watchlists.userEmail, email)).orderBy(desc(watchlists.updatedAt)),
    db.select().from(watchlistItems).where(eq(watchlistItems.userEmail, email)).orderBy(desc(watchlistItems.updatedAt)),
    db.select().from(alertRules).where(eq(alertRules.userEmail, email)),
  ]);
  return Response.json({
    items: lists.map((list) => ({
      ...list,
      items: items
        .filter((item) => item.watchlistId === list.id)
        .map((item) => ({
          ...item,
          snapshot: parsedJson(item.snapshotJson),
          rule: rules.find(
            (rule) => rule.entityType === item.entityType && rule.entityKey === item.entityKey,
          )
            ? {
                ...rules.find(
                  (rule) =>
                    rule.entityType === item.entityType && rule.entityKey === item.entityKey,
                )!,
                eventTypes: JSON.parse(
                  rules.find(
                    (rule) =>
                      rule.entityType === item.entityType && rule.entityKey === item.entityKey,
                  )!.eventTypesJson,
                ) as string[],
              }
            : null,
        })),
    })),
  });
}

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as WatchlistBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const entityType =
    body.entityType === "area" || body.entityType === "property" ? body.entityType : null;
  const entityKey = typeof body.entityKey === "string" ? body.entityKey.trim() : "";
  const requestedWatchlistId = Number(body.watchlistId);
  if (!entityType && !name) {
    return Response.json({ error: "Provide a watchlist name or an entity to monitor." }, { status: 400 });
  }
  if (name.length > 100 || description.length > 400) {
    return Response.json({ error: "Watchlist name or description is too long." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();

  let list;
  if (Number.isInteger(requestedWatchlistId) && requestedWatchlistId > 0) {
    [list] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.userEmail, email), eq(watchlists.id, requestedWatchlistId)))
      .limit(1);
    if (!list) return Response.json({ error: "Watchlist not found." }, { status: 404 });
  } else {
    const listName = name || "Investment watchlist";
    [list] = await db
      .insert(watchlists)
      .values({ userEmail: email, name: listName, description: description || null })
      .onConflictDoUpdate({
        target: [watchlists.userEmail, watchlists.name],
        set: { description: description || null, updatedAt: new Date().toISOString() },
      })
      .returning();
  }

  if (!entityType) return Response.json({ item: list }, { status: 201 });
  if (!entityKey) {
    return Response.json({ error: "entityKey is required for a monitored entity." }, { status: 400 });
  }

  let label: string;
  let snapshot: Record<string, unknown>;
  if (entityType === "area") {
    const [area, dataset] = await Promise.all([getArea(entityKey), loadDataset()]);
    if (!area) return Response.json({ error: "Area not found." }, { status: 404 });
    label = `${area.name}, ${area.county}`;
    snapshot = areaSnapshot(area, String(dataset.coverage.scoreReferenceYear));
  } else {
    const propertyId = Number(entityKey);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return Response.json({ error: "A valid property id is required." }, { status: 400 });
    }
    const [row] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.userEmail, email), eq(properties.id, propertyId)))
      .limit(1);
    if (!row) return Response.json({ error: "Property not found." }, { status: 404 });
    label = `${row.address}, ${row.city}`;
    snapshot = propertySnapshot({ ...row, derived: await deriveProperty(row) });
  }

  const now = new Date().toISOString();
  const [item] = await db
    .insert(watchlistItems)
    .values({
      watchlistId: list.id,
      userEmail: email,
      entityType,
      entityKey,
      label,
      snapshotJson: JSON.stringify(snapshot),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [watchlistItems.watchlistId, watchlistItems.entityType, watchlistItems.entityKey],
      set: { label },
    })
    .returning();
  const [rule] = await db
    .insert(alertRules)
    .values({
      userEmail: email,
      entityType,
      entityKey,
      eventTypesJson: JSON.stringify(defaultEventsByEntity[entityType as MonitoredEntityType]),
      enabled: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [alertRules.userEmail, alertRules.entityType, alertRules.entityKey],
      set: { enabled: true, updatedAt: now },
    })
    .returning();
  return Response.json(
    { item: { ...item, snapshot }, rule: { ...rule, eventTypes: JSON.parse(rule.eventTypesJson) } },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const search = new URL(request.url).searchParams;
  const itemId = Number(search.get("itemId"));
  const listId = Number(search.get("id"));
  await ensureSchema();
  const db = await getDb();
  if (Number.isInteger(itemId) && itemId > 0) {
    const [item] = await db
      .select()
      .from(watchlistItems)
      .where(and(eq(watchlistItems.userEmail, email), eq(watchlistItems.id, itemId)))
      .limit(1);
    if (!item) return Response.json({ error: "Watchlist item not found." }, { status: 404 });
    await db
      .delete(watchlistItems)
      .where(and(eq(watchlistItems.userEmail, email), eq(watchlistItems.id, itemId)));
    const [remaining] = await db
      .select({ id: watchlistItems.id })
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userEmail, email),
          eq(watchlistItems.entityType, item.entityType),
          eq(watchlistItems.entityKey, item.entityKey),
        ),
      )
      .limit(1);
    if (!remaining) {
      await db
        .delete(alertRules)
        .where(
          and(
            eq(alertRules.userEmail, email),
            eq(alertRules.entityType, item.entityType),
            eq(alertRules.entityKey, item.entityKey),
          ),
        );
    }
    return Response.json({ deleted: true });
  }
  if (Number.isInteger(listId) && listId > 0) {
    const [list] = await db
      .select()
      .from(watchlists)
      .where(and(eq(watchlists.userEmail, email), eq(watchlists.id, listId)))
      .limit(1);
    if (!list) return Response.json({ error: "Watchlist not found." }, { status: 404 });
    const listItems = await db
      .select()
      .from(watchlistItems)
      .where(and(eq(watchlistItems.userEmail, email), eq(watchlistItems.watchlistId, listId)));
    await db
      .delete(watchlistItems)
      .where(and(eq(watchlistItems.userEmail, email), eq(watchlistItems.watchlistId, listId)));
    for (const item of listItems) {
      const [remaining] = await db
        .select({ id: watchlistItems.id })
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.userEmail, email),
            eq(watchlistItems.entityType, item.entityType),
            eq(watchlistItems.entityKey, item.entityKey),
          ),
        )
        .limit(1);
      if (!remaining) {
        await db
          .delete(alertRules)
          .where(
            and(
              eq(alertRules.userEmail, email),
              eq(alertRules.entityType, item.entityType),
              eq(alertRules.entityKey, item.entityKey),
            ),
          );
      }
    }
    await db
      .delete(watchlists)
      .where(and(eq(watchlists.userEmail, email), eq(watchlists.id, listId)));
    return Response.json({ deleted: true });
  }
  return Response.json({ error: "A watchlist or item id is required." }, { status: 400 });
}
