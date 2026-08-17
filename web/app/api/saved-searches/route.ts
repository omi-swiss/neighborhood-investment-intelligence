import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { alertRules, properties, savedSearches } from "../../../db/schema";
import {
  defaultEventsByEntity,
  matchesPropertySearch,
  type PropertySearchQuery,
} from "../../lib/monitoring";
import { deriveProperty } from "../../lib/property-domain";
import { requestUserEmail } from "../../lib/request-user";

function parseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeQuery(value: unknown): PropertySearchQuery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const query: PropertySearchQuery = {};
  if (typeof input.search === "string") query.search = input.search.slice(0, 160);
  if (typeof input.propertyType === "string") query.propertyType = input.propertyType.slice(0, 80);
  for (const key of ["maximumPrice", "minimumGrossYield", "minimumCompleteness"] as const) {
    if (input[key] !== undefined) {
      const parsed = Number(input[key]);
      if (!Number.isFinite(parsed) || parsed < 0) return null;
      query[key] = parsed;
    }
  }
  return query;
}

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureSchema();
  const db = await getDb();
  const rows = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userEmail, email))
    .orderBy(desc(savedSearches.updatedAt));
  return Response.json({
    items: rows.map((row) => ({
      ...row,
      query: parseJson(row.queryJson),
      snapshot: parseJson(row.snapshotJson),
    })),
  });
}

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as {
    name?: unknown;
    searchType?: unknown;
    query?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const query = normalizeQuery(body.query);
  if (!name || name.length > 100 || body.searchType !== "property" || !query) {
    return Response.json(
      { error: "A short name, property search type, and valid query are required." },
      { status: 400 },
    );
  }
  await ensureSchema();
  const db = await getDb();
  const rows = await db.select().from(properties).where(eq(properties.userEmail, email));
  const propertyIds = (await Promise.all(rows
    .map(async (row) => ({ ...row, derived: await deriveProperty(row) }))))
    .filter((property) => matchesPropertySearch(property, query))
    .map((property) => property.id);
  const now = new Date().toISOString();
  const [item] = await db
    .insert(savedSearches)
    .values({
      userEmail: email,
      name,
      searchType: "property",
      queryJson: JSON.stringify(query),
      snapshotJson: JSON.stringify({ propertyIds, checkedAt: now }),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [savedSearches.userEmail, savedSearches.name],
      set: {
        searchType: "property",
        queryJson: JSON.stringify(query),
        snapshotJson: JSON.stringify({ propertyIds, checkedAt: now }),
        updatedAt: now,
      },
    })
    .returning();
  const [rule] = await db
    .insert(alertRules)
    .values({
      userEmail: email,
      entityType: "search",
      entityKey: String(item.id),
      eventTypesJson: JSON.stringify(defaultEventsByEntity.search),
      enabled: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [alertRules.userEmail, alertRules.entityType, alertRules.entityKey],
      set: { enabled: true, updatedAt: now },
    })
    .returning();
  return Response.json(
    { item: { ...item, query, snapshot: { propertyIds, checkedAt: now } }, rule },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "A valid saved-search id is required." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  await db
    .delete(alertRules)
    .where(
      and(
        eq(alertRules.userEmail, email),
        eq(alertRules.entityType, "search"),
        eq(alertRules.entityKey, String(id)),
      ),
    );
  const [deleted] = await db
    .delete(savedSearches)
    .where(and(eq(savedSearches.userEmail, email), eq(savedSearches.id, id)))
    .returning();
  if (!deleted) return Response.json({ error: "Saved search not found." }, { status: 404 });
  return Response.json({ deleted: true });
}
