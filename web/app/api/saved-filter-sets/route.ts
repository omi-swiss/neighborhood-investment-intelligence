import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { savedFilterSets } from "../../../db/schema";
import { defaultFilters } from "../../lib/areas";
import type { ScreenerFilters } from "../../lib/types";
import { SCORE_KEYS } from "../../lib/screener-query";
import { requestUserEmail } from "../../lib/request-user";

function validQuery(value: unknown): value is ScreenerFilters {
  if (!value || typeof value !== "object") return false;
  const query = value as Partial<ScreenerFilters>;
  return (
    typeof query.search === "string" &&
    ["all", "Washington", "Baltimore", "Philadelphia"].includes(query.city ?? "") &&
    typeof query.minimumScore === "number" &&
    typeof query.minimumIncomeGrowth === "number" &&
    typeof query.minimumGrossYield === "number" &&
    typeof query.maximumVacancy === "number" &&
    typeof query.sort === "string" &&
    (query.sortDirection === "asc" || query.sortDirection === "desc") &&
    typeof query.strategyKey === "string" &&
    typeof query.strategyName === "string" &&
    typeof query.strategyVersion === "number" &&
    !!query.strategyWeights &&
    SCORE_KEYS.every((key) => {
      const value = query.strategyWeights?.[key];
      return typeof value === "number" && Number.isFinite(value) && value >= 0;
    }) &&
    Object.keys(defaultFilters).every((key) => key in query)
  );
}

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureSchema();
  const db = await getDb();
  const rows = await db
    .select()
    .from(savedFilterSets)
    .where(eq(savedFilterSets.userEmail, email))
    .orderBy(desc(savedFilterSets.createdAt));
  return Response.json({
    items: rows.map((row) => ({ ...row, query: JSON.parse(row.queryJson), queryJson: undefined })),
  });
}

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as { name?: unknown; query?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200 || !validQuery(body.query)) {
    return Response.json({ error: "A valid name and screener query are required" }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  const [saved] = await db
    .insert(savedFilterSets)
    .values({ userEmail: email, name, queryJson: JSON.stringify(body.query) })
    .onConflictDoUpdate({
      target: [savedFilterSets.userEmail, savedFilterSets.name],
      set: { queryJson: JSON.stringify(body.query), schemaVersion: 1 },
    })
    .returning();
  return Response.json({ item: saved }, { status: 201 });
}

export async function DELETE(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "A valid id is required" }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  await db
    .delete(savedFilterSets)
    .where(and(eq(savedFilterSets.userEmail, email), eq(savedFilterSets.id, id)));
  return new Response(null, { status: 204 });
}
