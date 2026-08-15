import {
  validateFinancialAssumptions,
  type FinancialAssumptions,
} from "../../../lib/financial-model";
import {
  buildSensitivityMatrix,
  rankSensitivityDrivers,
  sensitivityMetricLabels,
  sensitivityPairLabels,
  type SensitivityMetric,
  type SensitivityPair,
} from "../../../lib/sensitivity";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    assumptions?: unknown;
    pair?: unknown;
    metric?: unknown;
  };
  const errors = validateFinancialAssumptions(body.assumptions);
  if (errors.length) {
    return Response.json({ error: "Invalid assumptions", details: errors }, { status: 400 });
  }
  const pair = body.pair as SensitivityPair;
  const metric = body.metric as SensitivityMetric;
  if (!Object.hasOwn(sensitivityPairLabels, pair)) {
    return Response.json({ error: "Unsupported sensitivity pair." }, { status: 400 });
  }
  if (!Object.hasOwn(sensitivityMetricLabels, metric)) {
    return Response.json({ error: "Unsupported sensitivity metric." }, { status: 400 });
  }
  const assumptions = body.assumptions as FinancialAssumptions;
  return Response.json({
    matrix: buildSensitivityMatrix(assumptions, pair, metric),
    drivers: rankSensitivityDrivers(assumptions, metric),
  });
}
