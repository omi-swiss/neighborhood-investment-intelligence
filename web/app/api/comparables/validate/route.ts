import { normalizeComparableInput } from "../../../lib/comparables";

export async function POST(request: Request) {
  const body = (await request.json()) as { rows?: unknown };
  if (!Array.isArray(body.rows) || body.rows.length > 500) {
    return Response.json({ error: "rows must be an array with at most 500 records." }, { status: 400 });
  }
  const accepted = [];
  const rejections = [];
  for (const [index, row] of body.rows.entries()) {
    const result = normalizeComparableInput(row, index + 2);
    if (result.value) accepted.push(result.value);
    if (result.rejection) rejections.push(result.rejection);
  }
  return Response.json({
    submitted: body.rows.length,
    accepted: accepted.length,
    rejected: rejections.length,
    normalized: accepted,
    rejections,
  });
}
