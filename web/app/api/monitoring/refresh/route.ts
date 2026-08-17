import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/initialize";
import {
  alertRules,
  alerts,
  properties,
  savedSearches,
  watchlistItems,
} from "../../../../db/schema";
import { getArea } from "../../../lib/areas";
import { loadDataset } from "../../../lib/areas";
import {
  areaSnapshot,
  detectMonitoringChanges,
  matchesPropertySearch,
  propertySnapshot,
  type AlertEventType,
  type PropertySearchQuery,
} from "../../../lib/monitoring";
import { deriveProperty, type PropertyWithDerived } from "../../../lib/property-domain";
import { requestUserEmail } from "../../../lib/request-user";

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseEvents(value: string): AlertEventType[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as AlertEventType[]) : [];
  } catch {
    return [];
  }
}

function propertyAlertFacts(property: PropertyWithDerived) {
  return {
    matched: true,
    propertyId: property.id,
    address: property.address,
    city: property.city,
    county: property.county,
    state: property.state,
    askingPrice: property.askingPrice,
    listingStatus: property.listingStatus,
    grossYield: property.derived.grossYield,
    updatedAt: property.updatedAt,
  };
}

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureSchema();
  const db = await getDb();
  const [items, rules, propertyRows, searches] = await Promise.all([
    db.select().from(watchlistItems).where(eq(watchlistItems.userEmail, email)),
    db.select().from(alertRules).where(eq(alertRules.userEmail, email)),
    db.select().from(properties).where(eq(properties.userEmail, email)),
    db.select().from(savedSearches).where(eq(savedSearches.userEmail, email)),
  ]);
  const propertyMap = new Map(
    (await Promise.all(propertyRows.map(async (row) => {
      const property = { ...row, derived: await deriveProperty(row) };
      return [String(row.id), property] as const;
    }))),
  );
  const dataset = await loadDataset();
  const ruleMap = new Map(rules.map((rule) => [`${rule.entityType}:${rule.entityKey}`, rule]));
  const now = new Date().toISOString();
  let created = 0;
  let checked = 0;

  for (const item of items) {
    const rule = ruleMap.get(`${item.entityType}:${item.entityKey}`);
    if (!rule || !rule.enabled) continue;
    const allowed = new Set(parseEvents(rule.eventTypesJson));
    const previous = parseObject(item.snapshotJson);
    let current: Record<string, unknown> | null = null;
    if (item.entityType === "area") {
      const area = await getArea(item.entityKey);
      if (area) current = areaSnapshot(area, String(dataset.coverage.scoreReferenceYear));
    } else if (item.entityType === "property") {
      const property = propertyMap.get(item.entityKey);
      if (property) current = propertySnapshot(property);
    }
    if (!current) continue;
    checked += 1;
    const changes = detectMonitoringChanges(
      item.entityType as "area" | "property",
      item.label,
      previous,
      current,
    );
    for (const change of changes.filter((candidate) => allowed.has(candidate.eventType))) {
      const fingerprint = [
        item.entityType,
        item.entityKey,
        change.eventType,
        change.fingerprintValue,
      ].join(":");
      const inserted = await db
        .insert(alerts)
        .values({
          userEmail: email,
          ruleId: rule.id,
          entityType: item.entityType,
          entityKey: item.entityKey,
          eventType: change.eventType,
          title: change.title,
          previousJson: change.previous ? JSON.stringify(change.previous) : null,
          currentJson: JSON.stringify(change.current),
          sourceName: change.sourceName,
          sourceUrl: change.sourceUrl,
          whyItMatters: change.whyItMatters,
          detectedAt: now,
          fingerprint,
        })
        .onConflictDoNothing()
        .returning({ id: alerts.id });
      created += inserted.length;
    }
    await db
      .update(watchlistItems)
      .set({ snapshotJson: JSON.stringify(current), updatedAt: now })
      .where(and(eq(watchlistItems.userEmail, email), eq(watchlistItems.id, item.id)));
  }

  for (const search of searches.filter((item) => item.searchType === "property")) {
    const rule = ruleMap.get(`search:${search.id}`);
    if (!rule || !rule.enabled || !parseEvents(rule.eventTypesJson).includes("new_property_listing")) {
      continue;
    }
    const query = parseObject(search.queryJson) as PropertySearchQuery;
    const previous = parseObject(search.snapshotJson);
    const previousIds = new Set(
      Array.isArray(previous.propertyIds)
        ? previous.propertyIds.map((value) => Number(value)).filter(Number.isInteger)
        : [],
    );
    const matches = [...propertyMap.values()].filter((property) =>
      matchesPropertySearch(property, query),
    );
    const currentIds = matches.map((property) => property.id);
    checked += 1;
    for (const property of matches.filter((candidate) => !previousIds.has(candidate.id))) {
      const current = propertyAlertFacts(property);
      const inserted = await db
        .insert(alerts)
        .values({
          userEmail: email,
          ruleId: rule.id,
          entityType: "property",
          entityKey: String(property.id),
          eventType: "new_property_listing",
          title: `${search.name}: new matching property`,
          previousJson: JSON.stringify({ matched: false }),
          currentJson: JSON.stringify(current),
          sourceName: property.sourceName,
          sourceUrl: property.sourceUrl,
          whyItMatters:
            "A newly imported property matches the saved acquisition criteria and may merit prompt review.",
          detectedAt: now,
          fingerprint: `search:${search.id}:new_property_listing:${property.id}:${property.updatedAt}`,
        })
        .onConflictDoNothing()
        .returning({ id: alerts.id });
      created += inserted.length;
    }
    await db
      .update(savedSearches)
      .set({
        snapshotJson: JSON.stringify({ propertyIds: currentIds, checkedAt: now }),
        updatedAt: now,
      })
      .where(and(eq(savedSearches.userEmail, email), eq(savedSearches.id, search.id)));
  }

  return Response.json({
    checked,
    created,
    checkedAt: now,
    delivery: "in_app",
    unavailable: [
      {
        eventType: "regulation_change",
        reason: "No validated regulation source is connected.",
      },
    ],
  });
}
