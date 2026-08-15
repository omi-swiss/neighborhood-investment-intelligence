import { normalizePropertyInput } from "../../../lib/property-domain";

export async function POST(request: Request) {
  const body = (await request.json()) as { rows?: unknown };
  if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 500) {
    return Response.json({ error: "A rows array containing 1-500 records is required." }, { status: 400 });
  }
  const accepted: unknown[] = [];
  const rejections: Array<{ row: number; reason: string }> = [];
  body.rows.forEach((row, index) => {
    const result = normalizePropertyInput(row, index + 2);
    if (result.value) accepted.push(result.value);
    else if (result.rejection) rejections.push(result.rejection);
  });
  return Response.json({
    submitted: body.rows.length,
    accepted: accepted.length,
    rejected: rejections.length,
    rejections,
  });
}
