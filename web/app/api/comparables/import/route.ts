import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/initialize";
import { propertyComparableRecords } from "../../../../db/schema";
import {
  normalizeComparableInput,
  type ComparableInsert,
} from "../../../lib/comparables";
import { requestUserEmail } from "../../../lib/request-user";

type ImportBody = {
  sourceName?: unknown;
  sourceLicense?: unknown;
  sourceUrl?: unknown;
  rows?: unknown;
};

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as ImportBody;
  const sourceName = typeof body.sourceName === "string" ? body.sourceName.trim() : "";
  const sourceLicense = typeof body.sourceLicense === "string" ? body.sourceLicense.trim() : "";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  if (!sourceName || !sourceLicense || !Array.isArray(body.rows)) {
    return Response.json({
      error: "sourceName, sourceLicense, and a rows array are required.",
    }, { status: 400 });
  }
  if (sourceName.length > 160 || sourceLicense.length > 300) {
    return Response.json({ error: "Import metadata exceeds supported lengths." }, { status: 400 });
  }
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
    } catch {
      return Response.json({ error: "sourceUrl must be an HTTP(S) URL." }, { status: 400 });
    }
  }
  if (!body.rows.length || body.rows.length > 500) {
    return Response.json({ error: "Each import must contain 1-500 rows." }, { status: 400 });
  }
  const accepted: ComparableInsert[] = [];
  const rejected: Array<{ row: number; reason: string }> = [];
  body.rows.forEach((row, index) => {
    const result = normalizeComparableInput(row, index + 2);
    if (result.value) accepted.push(result.value);
    else if (result.rejection) rejected.push(result.rejection);
  });
  await ensureSchema();
  const db = await getDb();
  for (const record of accepted) {
    const value = {
      ...record,
      userEmail: email,
      sourceName,
      sourceLicense,
      sourceUrl: sourceUrl || null,
      updatedAt: new Date().toISOString(),
    };
    await db.insert(propertyComparableRecords).values(value).onConflictDoUpdate({
      target: [
        propertyComparableRecords.userEmail,
        propertyComparableRecords.sourceName,
        propertyComparableRecords.sourceRecordId,
        propertyComparableRecords.comparableType,
      ],
      set: value,
    });
  }
  return Response.json({
    submitted: body.rows.length,
    accepted: accepted.length,
    rejected: rejected.length,
    rejections: rejected.slice(0, 100),
  }, { status: 201 });
}
