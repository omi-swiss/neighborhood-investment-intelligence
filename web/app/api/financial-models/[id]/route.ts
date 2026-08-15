import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/initialize";
import {
  financialModels,
  financialModelVersions,
  financialScenarios,
} from "../../../../db/schema";
import { requestUserEmail } from "../../../lib/request-user";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Valid model id required." }, { status: 400 });
  await ensureSchema();
  const db = await getDb();
  const [model] = await db.select().from(financialModels)
    .where(and(eq(financialModels.id, id), eq(financialModels.userEmail, email))).limit(1);
  if (!model) return Response.json({ error: "Model not found." }, { status: 404 });
  const [version] = await db.select().from(financialModelVersions)
    .where(and(eq(financialModelVersions.modelId, id), eq(financialModelVersions.userEmail, email)))
    .orderBy(desc(financialModelVersions.version)).limit(1);
  if (!version) return Response.json({ error: "Model has no saved version." }, { status: 404 });
  const scenarios = await db.select().from(financialScenarios)
    .where(and(eq(financialScenarios.modelVersionId, version.id), eq(financialScenarios.userEmail, email)));
  return Response.json({
    item: {
      ...model,
      version: version.version,
      calculationVersion: version.calculationVersion,
      assumptions: JSON.parse(version.assumptionsJson),
      scenarios: scenarios.map((scenario) => ({
        name: scenario.name,
        type: scenario.scenarioType,
        overrides: JSON.parse(scenario.overridesJson),
        results: JSON.parse(scenario.resultsJson),
      })),
    },
  });
}
