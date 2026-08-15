import datasetJson from "../data/areas.generated.json";
import type {
  AreaDataset,
  AreaRecord,
  MarketDefinition,
  MarketFocus,
  ScoreKey,
  ScreenerFilters,
  SortKey,
  StrategyDefinition,
  StrategyWeights,
} from "./types";

export const dataset = datasetJson as AreaDataset;
export const supportedMarkets = dataset.markets;

export const scoreDefinitions: Array<{
  key: ScoreKey;
  label: string;
  weight: number;
  direction: string;
  evidence: string;
}> = [
  {
    key: "demographicMomentum",
    label: "Demographic momentum",
    weight: 0.15,
    direction: "Higher growth is favorable",
    evidence: "Population compound annual growth, ACS 2019–2023",
  },
  {
    key: "incomeMomentum",
    label: "Income momentum",
    weight: 0.2,
    direction: "Higher real growth is favorable",
    evidence: "Inflation-adjusted household-income growth, ACS 2019–2023",
  },
  {
    key: "rentalStrength",
    label: "Rental-market strength",
    weight: 0.25,
    direction: "Yield/renter share higher; vacancy lower",
    evidence: "Gross-yield proxy, renter share, and rental vacancy",
  },
  {
    key: "housingDemand",
    label: "Housing demand",
    weight: 0.15,
    direction: "Occupancy higher and vacancy lower",
    evidence: "Occupied housing units and rental vacancy",
  },
  {
    key: "riskResilience",
    label: "Economic resilience",
    weight: 0.15,
    direction: "Poverty and unemployment lower",
    evidence: "Poverty and unemployment rates",
  },
  {
    key: "dataReliability",
    label: "Data reliability",
    weight: 0.1,
    direction: "Higher metric coverage is favorable",
    evidence: "Configured profile metric coverage",
  },
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
    weights: {
      demographicMomentum: 0.08,
      incomeMomentum: 0.12,
      rentalStrength: 0.42,
      housingDemand: 0.15,
      riskResilience: 0.13,
      dataReliability: 0.1,
    },
    minimumCoverage: 0.75,
    owner: "system",
  },
  {
    key: "emerging-neighborhood",
    name: "Emerging neighborhood",
    description: "Emphasizes population and real-income momentum over current defensive strength.",
    version: 1,
    weights: {
      demographicMomentum: 0.27,
      incomeMomentum: 0.28,
      rentalStrength: 0.18,
      housingDemand: 0.12,
      riskResilience: 0.05,
      dataReliability: 0.1,
    },
    minimumCoverage: 0.7,
    owner: "system",
  },
  {
    key: "low-risk-rental",
    name: "Low-risk rental income",
    description: "Prioritizes economic resilience, occupancy, and reliable evidence.",
    version: 1,
    weights: {
      demographicMomentum: 0.08,
      incomeMomentum: 0.12,
      rentalStrength: 0.2,
      housingDemand: 0.18,
      riskResilience: 0.3,
      dataReliability: 0.12,
    },
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

function finite(value: number | null): number {
  return value ?? Number.NEGATIVE_INFINITY;
}

function sortValue(area: AreaRecord, key: SortKey): number | string {
  if (key === "area") return `${area.county} ${area.name} ${area.id}`.toLowerCase();
  if (key === "score") return finite(area.score);
  return finite(area.metrics[key]);
}

function compareAreas(left: AreaRecord, right: AreaRecord, filters: ScreenerFilters): number {
  const leftValue = sortValue(left, filters.sort);
  const rightValue = sortValue(right, filters.sort);
  const direction = filters.sortDirection === "asc" ? 1 : -1;
  if (typeof leftValue === "string" && typeof rightValue === "string") {
    return leftValue.localeCompare(rightValue) * direction;
  }
  const leftNumber = leftValue as number;
  const rightNumber = rightValue as number;
  if (!Number.isFinite(leftNumber) && !Number.isFinite(rightNumber)) return 0;
  if (!Number.isFinite(leftNumber)) return 1;
  if (!Number.isFinite(rightNumber)) return -1;
  return (leftNumber - rightNumber) * direction;
}

export function weightedAreaScore(
  area: AreaRecord,
  weights: StrategyWeights,
): number | null {
  let numerator = 0;
  let denominator = 0;
  for (const definition of scoreDefinitions) {
    const value = area.scores[definition.key];
    const weight = weights[definition.key];
    if (value !== null && Number.isFinite(value) && weight > 0) {
      numerator += value * weight;
      denominator += weight;
    }
  }
  return denominator > 0 ? Math.round((numerator / denominator) * 10) / 10 : null;
}

export function filterAreas(filters: ScreenerFilters): AreaRecord[] {
  const query = filters.search.trim().toLowerCase();
  return dataset.areas
    .map((area) => ({
      ...area,
      score: weightedAreaScore(area, filters.strategyWeights),
    }))
    .filter((area) => {
      const matchesQuery =
        !query ||
        [area.name, area.tractLabel, area.id, area.city, area.county, area.metro, area.stateAbbr]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return (
        (filters.city === "all" || area.marketId === filters.city) &&
        matchesQuery &&
        finite(area.score) >= filters.minimumScore &&
        finite(area.metrics.incomeGrowth) >= filters.minimumIncomeGrowth &&
        finite(area.metrics.grossYieldProxy) >= filters.minimumGrossYield &&
        (area.metrics.vacancyRate ?? Number.POSITIVE_INFINITY) <=
          filters.maximumVacancy
      );
    })
    .sort((left, right) => compareAreas(left, right, filters));
}

export function getMapContextAreas(market: MarketFocus): AreaRecord[] {
  return market === "all"
    ? dataset.areas
    : dataset.areas.filter((area) => area.marketId === market);
}

export function getMarket(marketId: MarketFocus): MarketDefinition | null {
  if (marketId === "all") return null;
  return dataset.markets.find((market) => market.id === marketId) ?? null;
}

export function getArea(areaId: string): AreaRecord | undefined {
  return dataset.areas.find((area) => area.id === areaId);
}

export function formatCurrency(value: number | null): string {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatInteger(value: number | null): string {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number | null, signed = false): string {
  if (value === null) return "Not available";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: signed ? "exceptZero" : "auto",
  }).format(value);
}
