import { scoreDefinitions } from "./area-shared";
import type { AreaRecord, ScoreKey } from "./types";

export type MarketCenter = { latitude: number; longitude: number };

export type AreaDecisionInsight = {
  marketQualityScore: number | null;
  rentalDemandScore: number | null;
  valuationScore: number | null;
  riskLabel: "Low" | "Moderate" | "Elevated" | "Missing";
  dataConfidence: "High" | "Medium" | "Low" | "Missing";
  primaryPositive: string;
  primaryRisk: string;
  thesis: string;
  positiveContributors: Array<{ key: ScoreKey; label: string; score: number }>;
  negativeContributors: Array<{ key: ScoreKey; label: string; score: number }>;
  missingFactors: string[];
};

function dataConfidence(
  coverage: number | null,
  reliabilities: string[],
): "High" | "Medium" | "Low" | "Missing" {
  if (coverage === null) return "Missing";
  const normalized = reliabilities.map((value) => value.toLowerCase());
  if (coverage < 0.72 || normalized.includes("unreliable")) return "Low";
  if (coverage < 0.9 || normalized.includes("caution")) return "Medium";
  return "High";
}

function roundedAverage(values: Array<number | null | undefined>): number | null {
  const available = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  if (!available.length) return null;
  return Math.round((available.reduce((sum, value) => sum + value, 0) / available.length) * 10) / 10;
}

function percent(value: number | null): string {
  if (value === null) return "unavailable";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }).format(value);
}

function directionFromCenter(area: AreaRecord, center?: MarketCenter): string | null {
  if (!center || area.latitude === null || area.longitude === null) return null;
  const latitudeDelta = area.latitude - center.latitude;
  const longitudeDelta = area.longitude - center.longitude;
  const vertical = Math.abs(latitudeDelta) < 0.012 ? "" : latitudeDelta > 0 ? "North" : "South";
  const horizontal = Math.abs(longitudeDelta) < 0.012 ? "" : longitudeDelta > 0 ? "east" : "west";
  if (!vertical && !horizontal) return "Central";
  if (vertical && horizontal) return `${vertical}${horizontal}`;
  return vertical || `${horizontal[0]?.toUpperCase() ?? ""}${horizontal.slice(1)}`;
}

export function buildMarketCenters(areas: AreaRecord[]): Record<string, MarketCenter> {
  const groups = new Map<string, { latitude: number; longitude: number; count: number }>();
  for (const area of areas) {
    if (area.latitude === null || area.longitude === null) continue;
    const group = groups.get(area.marketId) ?? { latitude: 0, longitude: 0, count: 0 };
    group.latitude += area.latitude;
    group.longitude += area.longitude;
    group.count += 1;
    groups.set(area.marketId, group);
  }
  return Object.fromEntries([...groups.entries()].map(([marketId, group]) => [marketId, {
    latitude: group.latitude / group.count,
    longitude: group.longitude / group.count,
  }]));
}

export function investorAreaName(area: AreaRecord, center?: MarketCenter): string {
  if (area.neighborhood) return area.neighborhood;
  if (area.name && area.name !== area.tractLabel && !/^census tract/i.test(area.name)) return area.name;
  const direction = directionFromCenter(area, center);
  return direction ? `${direction} ${area.city}` : `${area.city} submarket`;
}

export function areaDecisionInsight(area: AreaRecord): AreaDecisionInsight {
  const investmentDefinitions = scoreDefinitions.filter(
    (definition) => definition.key !== "dataReliability",
  );
  const ranked = investmentDefinitions
    .flatMap((definition) => {
      const score = area.scores[definition.key];
      return score === null ? [] : [{ key: definition.key, label: definition.label, score }];
    })
    .sort((left, right) => right.score - left.score);
  const missingFactors = investmentDefinitions
    .filter((definition) => area.scores[definition.key] === null)
    .map((definition) => definition.label);
  const strongest = ranked[0];
  const weakest = ranked.at(-1);
  const resilience = area.scores.riskResilience;
  const coverage = area.metrics.metricCoverage;
  const riskLabel = resilience === null ? "Missing" : resilience >= 70 ? "Low" : resilience >= 45 ? "Moderate" : "Elevated";
  const confidence = dataConfidence(coverage, [
    area.quality.populationReliability,
    area.quality.incomeReliability,
  ]);
  const positive = strongest
    ? `${strongest.label} is the strongest observed factor (${Math.round(strongest.score)}/100).`
    : "No scored factor is available.";
  const risk = weakest
    ? `${weakest.label} is the weakest observed factor (${Math.round(weakest.score)}/100).`
    : "Risk evidence is incomplete and requires due diligence.";
  const trendText = area.metrics.incomeGrowth !== null
    ? `Real household income trend is ${percent(area.metrics.incomeGrowth)}`
    : "Real household income trend is unavailable";
  const yieldText = area.metrics.grossYieldProxy !== null
    ? `the area gross-yield proxy is ${percent(area.metrics.grossYieldProxy)}`
    : "the area gross-yield proxy is unavailable";
  return {
    marketQualityScore: roundedAverage([
      area.scores.demographicMomentum,
      area.scores.incomeMomentum,
      area.scores.rentalStrength,
      area.scores.housingDemand,
      area.scores.riskResilience,
    ]),
    rentalDemandScore: roundedAverage([area.scores.rentalStrength, area.scores.housingDemand]),
    valuationScore: area.scores.rentalStrength,
    riskLabel,
    dataConfidence: confidence,
    primaryPositive: positive,
    primaryRisk: risk,
    thesis: `${positive} ${trendText}, and ${yieldText}.`,
    positiveContributors: ranked.slice(0, 3),
    negativeContributors: [...ranked].reverse().slice(0, 3),
    missingFactors,
  };
}
