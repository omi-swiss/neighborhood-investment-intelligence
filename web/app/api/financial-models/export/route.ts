import { csvCell } from "../../../lib/csv";
import {
  applyScenario,
  calculateFinancialModel,
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
  const assumptions = body.assumptions as FinancialAssumptions;
  const effective = body.scenario ? applyScenario(assumptions, body.scenario) : assumptions;
  let results;
  try {
    results = calculateFinancialModel(effective);
  } catch (error) {
    return Response.json({
      error: "Scenario assumptions are invalid.",
      details: [error instanceof Error ? error.message : "Calculation failed."],
    }, { status: 400 });
  }
  const headers = [
    "scenario", "calculation_version", "year", "gross_potential_income", "lease_up_loss",
    "vacancy_credit_loss", "effective_gross_income", "operating_expenses",
    "net_operating_income", "capital_reserves", "debt_service", "principal_paid",
    "interest_paid", "ending_loan_balance", "pre_tax_cash_flow", "sale_proceeds",
    "total_cash_flow",
  ];
  const scenarioName = body.scenario?.name ?? "Base case";
  const rows = results.projections.map((row) => [
    scenarioName,
    results.calculationVersion,
    row.year,
    row.grossPotentialIncome,
    row.leaseUpLoss,
    row.vacancyAndCreditLoss,
    row.effectiveGrossIncome,
    row.operatingExpenses,
    row.netOperatingIncome,
    row.capitalReserves,
    row.debtService,
    row.principalPaid,
    row.interestPaid,
    row.endingLoanBalance,
    row.preTaxCashFlow,
    row.saleProceeds,
    row.totalCashFlow,
  ].map(csvCell).join(","));
  return new Response([headers.join(","), ...rows].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nii-financial-projection.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
