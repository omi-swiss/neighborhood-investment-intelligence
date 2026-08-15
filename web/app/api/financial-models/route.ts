import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import {
  financialModels,
  financialModelVersions,
  financialScenarios,
  properties,
} from "../../../db/schema";
import {
  CALCULATION_VERSION,
  applyScenario,
  calculateFinancialModel,
  validateFinancialAssumptions,
  validateScenarioDefinition,
  type FinancialAssumptions,
  type ScenarioDefinition,
} from "../../lib/financial-model";
import { requestUserEmail } from "../../lib/request-user";

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  await ensureSchema();
  const db = await getDb();
  const [models, versions] = await Promise.all([
    db.select().from(financialModels).where(eq(financialModels.userEmail, email)).orderBy(desc(financialModels.updatedAt)),
    db.select().from(financialModelVersions).where(eq(financialModelVersions.userEmail, email)).orderBy(desc(financialModelVersions.version)),
  ]);
  return Response.json({
    items: models.map((model) => ({
      ...model,
      latestVersion: versions.find((version) => version.modelId === model.id)?.version ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as {
    modelId?: unknown;
    assumptions?: unknown;
    scenarios?: unknown;
  };
  const errors = validateFinancialAssumptions(body.assumptions);
  if (errors.length) return Response.json({ error: "Invalid assumptions", details: errors }, { status: 400 });
  if (!Array.isArray(body.scenarios) || !body.scenarios.length || body.scenarios.length > 8) {
    return Response.json({ error: "One to eight scenarios are required." }, { status: 400 });
  }
  const assumptions = body.assumptions as FinancialAssumptions;
  const scenarios = body.scenarios as ScenarioDefinition[];
  const scenarioErrors = scenarios.flatMap((scenario, index) =>
    validateScenarioDefinition(scenario).map((error) => `Scenario ${index + 1}: ${error}`),
  );
  if (scenarioErrors.length) {
    return Response.json({ error: "Invalid scenarios", details: scenarioErrors }, { status: 400 });
  }
  const scenarioCalculationErrors = scenarios.flatMap((scenario) =>
    validateFinancialAssumptions(applyScenario(assumptions, scenario))
      .map((error) => `${scenario.name}: ${error}`),
  );
  if (scenarioCalculationErrors.length) {
    return Response.json({
      error: "Scenario assumptions are invalid.",
      details: scenarioCalculationErrors,
    }, { status: 400 });
  }
  const calculatedScenarios = scenarios.map((scenario) => ({
    scenario,
    results: calculateFinancialModel(applyScenario(assumptions, scenario)),
  }));
  if (assumptions.propertyId !== null) {
    await ensureSchema();
    const db = await getDb();
    const [property] = await db.select({ id: properties.id }).from(properties)
      .where(and(eq(properties.id, assumptions.propertyId), eq(properties.userEmail, email))).limit(1);
    if (!property) return Response.json({ error: "Linked property not found." }, { status: 404 });
  }
  await ensureSchema();
  const db = await getDb();
  let modelId = Number(body.modelId);
  if (Number.isInteger(modelId) && modelId > 0) {
    const [owned] = await db
      .select({ id: financialModels.id })
      .from(financialModels)
      .where(and(eq(financialModels.id, modelId), eq(financialModels.userEmail, email)))
      .limit(1);
    if (!owned) return Response.json({ error: "Model not found." }, { status: 404 });
    await db.update(financialModels).set({
      name: assumptions.modelName.trim(),
      propertyId: assumptions.propertyId,
      updatedAt: new Date().toISOString(),
    }).where(and(eq(financialModels.id, modelId), eq(financialModels.userEmail, email)));
  } else {
    const [model] = await db.insert(financialModels).values({
      userEmail: email,
      propertyId: assumptions.propertyId,
      name: assumptions.modelName.trim(),
      updatedAt: new Date().toISOString(),
    }).returning();
    modelId = model.id;
  }
  const existing = await db.select({ version: financialModelVersions.version })
    .from(financialModelVersions)
    .where(and(eq(financialModelVersions.modelId, modelId), eq(financialModelVersions.userEmail, email)));
  const version = Math.max(0, ...existing.map((item) => item.version)) + 1;
  const [savedVersion] = await db.insert(financialModelVersions).values({
    modelId,
    userEmail: email,
    version,
    assumptionsJson: JSON.stringify(assumptions),
    calculationVersion: CALCULATION_VERSION,
  }).returning();
  for (const { scenario, results } of calculatedScenarios) {
    await db.insert(financialScenarios).values({
      modelVersionId: savedVersion.id,
      userEmail: email,
      name: scenario.name.trim(),
      scenarioType: scenario.type,
      overridesJson: JSON.stringify(scenario.overrides),
      resultsJson: JSON.stringify(results),
    });
  }
  return Response.json({ modelId, version, calculationVersion: CALCULATION_VERSION }, { status: 201 });
}

export async function DELETE(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const modelId = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(modelId) || modelId <= 0) {
    return Response.json({ error: "Valid model id required." }, { status: 400 });
  }
  await ensureSchema();
  const db = await getDb();
  const [owned] = await db.select({ id: financialModels.id }).from(financialModels)
    .where(and(eq(financialModels.id, modelId), eq(financialModels.userEmail, email))).limit(1);
  if (!owned) return Response.json({ error: "Model not found." }, { status: 404 });
  const versions = await db.select({ id: financialModelVersions.id })
    .from(financialModelVersions)
    .where(and(eq(financialModelVersions.modelId, modelId), eq(financialModelVersions.userEmail, email)));
  for (const version of versions) {
    await db.delete(financialScenarios).where(
      and(
        eq(financialScenarios.modelVersionId, version.id),
        eq(financialScenarios.userEmail, email),
      ),
    );
  }
  await db.delete(financialModelVersions).where(
    and(eq(financialModelVersions.modelId, modelId), eq(financialModelVersions.userEmail, email)),
  );
  await db.delete(financialModels).where(
    and(eq(financialModels.id, modelId), eq(financialModels.userEmail, email)),
  );
  return Response.json({ deleted: true });
}
