import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/initialize";
import {
  properties,
  propertyImports,
  propertyListingHistory,
} from "../../../../db/schema";
import {
  normalizePropertyInput,
  type NormalizedPropertyInput,
} from "../../../lib/property-domain";
import { requestUserEmail } from "../../../lib/request-user";

type ImportBody = {
  filename?: unknown;
  sourceName?: unknown;
  sourceLicense?: unknown;
  sourceUrl?: unknown;
  rows?: unknown;
};

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as ImportBody;
  const filename = typeof body.filename === "string" ? body.filename.trim() : "";
  const sourceName = typeof body.sourceName === "string" ? body.sourceName.trim() : "";
  const sourceLicense = typeof body.sourceLicense === "string" ? body.sourceLicense.trim() : "";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  if (!filename || !sourceName || !sourceLicense || !Array.isArray(body.rows)) {
    return Response.json(
      { error: "filename, sourceName, sourceLicense, and a rows array are required." },
      { status: 400 },
    );
  }
  if (filename.length > 240 || sourceName.length > 160 || sourceLicense.length > 300) {
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
  const accepted: NormalizedPropertyInput[] = [];
  const rejected: Array<{ row: number; reason: string }> = [];
  body.rows.forEach((row, index) => {
    const result = normalizePropertyInput(row, index + 2);
    if (result.value) accepted.push(result.value);
    else if (result.rejection) rejected.push(result.rejection);
  });
  await ensureSchema();
  const db = await getDb();
  const [importRow] = await db
    .insert(propertyImports)
    .values({
      userEmail: email,
      filename,
      sourceName,
      sourceLicense,
      sourceUrl: sourceUrl || null,
      submittedCount: body.rows.length,
      acceptedCount: accepted.length,
      rejectedCount: rejected.length,
    })
    .returning();
  if (accepted.length) {
    const values = accepted.map((property) => ({
      ...property,
      userEmail: email,
      importId: importRow.id,
      sourceName,
      sourceLicense,
      sourceUrl: sourceUrl || null,
      updatedAt: new Date().toISOString(),
    }));
    for (const value of values) {
      const [saved] = await db
        .insert(properties)
        .values(value)
        .onConflictDoUpdate({
          target: [properties.userEmail, properties.sourceName, properties.sourceRecordId],
          set: value,
        })
        .returning({ id: properties.id });
      await db
        .insert(propertyListingHistory)
        .values({
          userEmail: email,
          propertyId: saved.id,
          askingPrice: value.askingPrice,
          listingStatus: value.listingStatus ?? "active",
          observedAt: value.observedAt,
          sourceName,
        })
        .onConflictDoNothing();
    }
  }
  return Response.json(
    {
      importId: importRow.id,
      submitted: body.rows.length,
      accepted: accepted.length,
      rejected: rejected.length,
      rejections: rejected.slice(0, 100),
    },
    { status: 201 },
  );
}
