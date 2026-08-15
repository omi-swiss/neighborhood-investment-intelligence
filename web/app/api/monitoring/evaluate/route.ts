import { detectMonitoringChanges } from "../../../lib/monitoring";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    entityType?: unknown;
    label?: unknown;
    previous?: unknown;
    current?: unknown;
  };
  if (
    (body.entityType !== "area" && body.entityType !== "property") ||
    typeof body.label !== "string" ||
    !body.previous ||
    typeof body.previous !== "object" ||
    Array.isArray(body.previous) ||
    !body.current ||
    typeof body.current !== "object" ||
    Array.isArray(body.current)
  ) {
    return Response.json({ error: "A valid entity type, label, and two snapshots are required." }, { status: 400 });
  }
  return Response.json({
    changes: detectMonitoringChanges(
      body.entityType,
      body.label,
      body.previous as Record<string, unknown>,
      body.current as Record<string, unknown>,
    ),
  });
}
