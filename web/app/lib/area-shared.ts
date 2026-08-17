import type {
  ScoreKey,
  ScreenerFilters,
  StrategyDefinition,
  StrategyWeights,
} from "./types";

export const scoreDefinitions: Array<{
  key: ScoreKey;
  label: string;
  weight: number;
  direction: string;
  evidence: string;
}> = [
  { key: "demographicMomentum", label: "Demographic momentum", weight: 0.15, direction: "Higher growth is favorable", evidence: "Population compound annual growth, ACS 2020–2024" },
  { key: "incomeMomentum", label: "Income momentum", weight: 0.2, direction: "Higher real growth is favorable", evidence: "Inflation-adjusted household-income growth, ACS 2020–2024" },
  { key: "rentalStrength", label: "Rental-market strength", weight: 0.25, direction: "Yield/renter share higher; vacancy lower", evidence: "Gross-yield proxy, renter share, and rental vacancy" },
  { key: "housingDemand", label: "Housing demand", weight: 0.15, direction: "Occupancy higher and vacancy lower", evidence: "Occupied housing units and rental vacancy" },
  { key: "riskResilience", label: "Economic resilience", weight: 0.15, direction: "Poverty and unemployment lower", evidence: "Poverty and unemployment rates" },
  { key: "dataReliability", label: "Data reliability", weight: 0.1, direction: "Higher metric coverage is favorable", evidence: "Configured profile metric coverage" },
];

export const balancedWeights: StrategyWeights = {
  demographicMomentum: 0.15,
  incomeMomentum: 0.2,
  rentalStrength: 0.25,
  housingDemand: 0.15,
  riskResilience: 0.15,
  dataReliability: 0.1,
};

export const builtInStrategies: StrategyDefinition[] = [
  {
    key: "balanced",
    name: "Balanced opportunity",
    description: "Balances growth, rental economics, demand, resilience, and data quality.",
    version: 1,
    weights: balancedWeights,
    minimumCoverage: 0.7,
    owner: "system",
  },
  {
    key: "rental-cash-flow",
    name: "Rental cash flow",
    description: "Raises the influence of rent-to-value, renter demand, and vacancy evidence.",
    version: 1,
    weights: { demographicMomentum: 0.08, incomeMomentum: 0.12, rentalStrength: 0.42, housingDemand: 0.15, riskResilience: 0.13, dataReliability: 0.1 },
    minimumCoverage: 0.75,
    owner: "system",
  },
  {
    key: "emerging-neighborhood",
    name: "Emerging neighborhood",
    description: "Emphasizes population and real-income momentum over current defensive strength.",
    version: 1,
    weights: { demographicMomentum: 0.27, incomeMomentum: 0.28, rentalStrength: 0.18, housingDemand: 0.12, riskResilience: 0.05, dataReliability: 0.1 },
    minimumCoverage: 0.7,
    owner: "system",
  },
  {
    key: "low-risk-rental",
    name: "Low-risk rental income",
    description: "Prioritizes economic resilience, occupancy, and reliable evidence.",
    version: 1,
    weights: { demographicMomentum: 0.08, incomeMomentum: 0.12, rentalStrength: 0.2, housingDemand: 0.18, riskResilience: 0.3, dataReliability: 0.12 },
    minimumCoverage: 0.8,
    owner: "system",
  },
];

export const defaultFilters: ScreenerFilters = {
  search: "",
  city: "all",
  minimumScore: 0,
  minimumIncomeGrowth: -0.03,
  minimumGrossYield: 0,
  maximumVacancy: 0.3,
  sort: "score",
  sortDirection: "desc",
  strategyKey: builtInStrategies[0].key,
  strategyName: builtInStrategies[0].name,
  strategyVersion: builtInStrategies[0].version,
  strategyWeights: builtInStrategies[0].weights,
};

export function formatCurrency(value: number | null): string {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function formatInteger(value: number | null): string {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null, signed = false): string {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1, signDisplay: signed ? "exceptZero" : "auto" }).format(value);
}
