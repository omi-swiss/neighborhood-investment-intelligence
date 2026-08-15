import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { ensureSchema } from "../../../../../db/initialize";
import {
  properties,
  propertyComparableRecords,
  propertyComparableSelections,
} from "../../../../../db/schema";
import {
  analyzeComparables,
  COMPARABLE_TYPES,
  defaultComparableFilters,
  type ComparableFilters,
  type ComparableType,
} from "../../../../lib/comparables";
import { requestUserEmail } from "../../../../lib/request-user";

type Context = { params: Promise<{ id: string }> };

function boundedNumber(value: string | null, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

export async function GET(request: Request, { params }: Context) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const subjectId = Number((await params).id);
  if (!Number.isInteger(subjectId) || subjectId <= 0) {
    return Response.json({ error: "Valid property id required." }, { status: 400 });
  }
  const search = new URL(request.url).searchParams;
  const comparableType = (search.get("type") ?? "sale") as ComparableType;
  if (!COMPARABLE_TYPES.includes(comparableType)) {
    return Response.json({ error: "type must be sale or rental." }, { status: 400 });
  }
  const filters: ComparableFilters = {
    radiusMiles: boundedNumber(search.get("radiusMiles"), defaultComparableFilters.radiusMiles, 0.1, 50),
    sameTractOnly: search.get("sameTractOnly") === "true",
    samePropertyType: search.get("samePropertyType") !== "false",
    maximumUnitDifference: boundedNumber(search.get("maximumUnitDifference"), defaultComparableFilters.maximumUnitDifference, 0, 100),
    sizeTolerance: boundedNumber(search.get("sizeTolerance"), defaultComparableFilters.sizeTolerance, 0, 2),
    ageToleranceYears: boundedNumber(search.get("ageToleranceYears"), defaultComparableFilters.ageToleranceYears, 0, 200),
    maximumAgeMonths: boundedNumber(search.get("maximumAgeMonths"), defaultComparableFilters.maximumAgeMonths, 1, 240),
  };
  await ensureSchema();
  const db = await getDb();
  const [subject] = await db.select().from(properties).where(
    and(eq(properties.id, subjectId), eq(properties.userEmail, email)),
  ).limit(1);
  if (!subject) return Response.json({ error: "Property not found." }, { status: 404 });
  const [records, selections] = await Promise.all([
    db.select().from(propertyComparableRecords).where(
      and(
        eq(propertyComparableRecords.userEmail, email),
        eq(propertyComparableRecords.comparableType, comparableType),
      ),
    ),
    db.select().from(propertyComparableSelections).where(
      and(
        eq(propertyComparableSelections.userEmail, email),
        eq(propertyComparableSelections.subjectPropertyId, subjectId),
      ),
    ),
  ]);
  return Response.json({
    analysis: analyzeComparables({
      subject,
      records,
      selections,
      comparableType,
      filters,
    }),
    filters,
  });
}

export async function POST(request: Request, { params }: Context) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const subjectId = Number((await params).id);
  const body = (await request.json()) as {
    comparableRecordId?: unknown;
    decision?: unknown;
    adjustmentPercent?: unknown;
    adjustmentNotes?: unknown;
  };
  const comparableRecordId = Number(body.comparableRecordId);
  const decision = typeof body.decision === "string" ? body.decision : "";
  const adjustmentPercent = Number(body.adjustmentPercent ?? 0);
  const adjustmentNotes =
    typeof body.adjustmentNotes === "string" ? body.adjustmentNotes.trim() : "";
  if (!Number.isInteger(subjectId) || subjectId <= 0 || !Number.isInteger(comparableRecordId) || comparableRecordId <= 0) {
    return Response.json({ error: "Valid subject and comparable ids are required." }, { status: 400 });
  }
  if (!["automatic", "include", "exclude"].includes(decision)) {
    return Response.json({ error: "decision must be automatic, include, or exclude." }, { status: 400 });
  }
  if (!Number.isFinite(adjustmentPercent) || adjustmentPercent < -0.5 || adjustmentPercent > 1) {
    return Response.json({ error: "adjustmentPercent must be between -0.5 and 1." }, { status: 400 });
  }
  if (adjustmentNotes.length > 500) {
    return Response.json({ error: "adjustmentNotes must be 500 characters or fewer." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  const [[subject], [record]] = await Promise.all([
    db.select({ id: properties.id }).from(properties).where(
      and(eq(properties.id, subjectId), eq(properties.userEmail, email)),
    ).limit(1),
    db.select({ id: propertyComparableRecords.id }).from(propertyComparableRecords).where(
      and(
        eq(propertyComparableRecords.id, comparableRecordId),
        eq(propertyComparableRecords.userEmail, email),
      ),
    ).limit(1),
  ]);
  if (!subject || !record) return Response.json({ error: "Property or comparable not found." }, { status: 404 });
  const match = and(
    eq(propertyComparableSelections.userEmail, email),
    eq(propertyComparableSelections.subjectPropertyId, subjectId),
    eq(propertyComparableSelections.comparableRecordId, comparableRecordId),
  );
  if (decision === "automatic") {
    await db.delete(propertyComparableSelections).where(match);
  } else {
    const value = {
      userEmail: email,
      subjectPropertyId: subjectId,
      comparableRecordId,
      decision,
      adjustmentPercent,
      adjustmentNotes: adjustmentNotes || null,
      updatedAt: new Date().toISOString(),
    };
    await db.insert(propertyComparableSelections).values(value).onConflictDoUpdate({
      target: [
        propertyComparableSelections.userEmail,
        propertyComparableSelections.subjectPropertyId,
        propertyComparableSelections.comparableRecordId,
      ],
      set: value,
    });
  }
  return Response.json({ saved: true });
}
