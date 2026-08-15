import {
  applyScenario,
  calculateFinancialModel,
  normalizeFinancialAssumptions,
  validateFinancialAssumptions,
  validateScenarioDefinition,
  type FinancialAssumptions,
  type ScenarioDefinition,
} from "../../../lib/financial-model";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    assumptions?: unknown;
    scenario?: ScenarioDefinition;
  };
  const errors = validateFinancialAssumptions(body.assumptions);
  if (errors.length) return Response.json({ error: "Invalid assumptions", details: errors }, { status: 400 });
  const scenarioErrors = body.scenario ? validateScenarioDefinition(body.scenario) : [];
  if (scenarioErrors.length) {
    return Response.json({ error: "Invalid scenario", details: scenarioErrors }, { status: 400 });
  }
  const assumptions = normalizeFinancialAssumptions(body.assumptions as FinancialAssumptions);
  const effective = body.scenario ? applyScenario(assumptions, body.scenario) : assumptions;
  try {
    return Response.json({ results: calculateFinancialModel(effective) });
  } catch (error) {
    return Response.json({
      error: "Scenario assumptions are invalid.",
      details: [error instanceof Error ? error.message : "Calculation failed."],
    }, { status: 400 });
  }
}
