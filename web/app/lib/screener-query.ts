import { balancedWeights, defaultFilters } from "./area-shared";
import type {
  MarketFocus,
  ScoreKey,
  SortDirection,
  ScreenerFilters,
  SortKey,
  StrategyWeights,
} from "./types";

const SORTS = new Set<SortKey>([
  "area",
  "score",
  "medianHouseholdIncome",
  "medianHomeValue",
  "incomeGrowth",
  "populationGrowth",
  "grossYieldProxy",
  "vacancyRate",
  "metricCoverage",
]);
const SORT_DIRECTIONS = new Set<SortDirection>(["asc", "desc"]);
const MARKET_FOCUS_PATTERN = /^(?:all|place:\d{7}|metro:\d{5})$/;

export const SCORE_KEYS: ScoreKey[] = [
  "demographicMomentum",
  "incomeMomentum",
  "rentalStrength",
  "housingDemand",
  "riskResilience",
  "dataReliability",
];

function numeric(search: URLSearchParams, name: string, fallback: number): number {
  const raw = search.get(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function parseWeights(raw: string | null): StrategyWeights {
  if (!raw) return balancedWeights;
  const values = raw.split(",").map(Number);
  if (
    values.length !== SCORE_KEYS.length ||
    values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)
  ) {
    return balancedWeights;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return balancedWeights;
  return Object.fromEntries(
    SCORE_KEYS.map((key, index) => [key, values[index] / total]),
  ) as StrategyWeights;
}

export function filtersFromSearch(search: URLSearchParams): ScreenerFilters {
  const requestedSort = search.get("sort") as SortKey | null;
  const requestedDirection = search.get("sortDirection") as SortDirection | null;
  const requestedCity = search.get("market") ?? search.get("city");
  return {
    search: search.get("search") ?? defaultFilters.search,
    city:
      requestedCity && MARKET_FOCUS_PATTERN.test(requestedCity)
        ? requestedCity as MarketFocus
        : defaultFilters.city,
    minimumScore: numeric(search, "minimumScore", defaultFilters.minimumScore),
    minimumIncomeGrowth: numeric(
      search,
      "minimumIncomeGrowth",
      defaultFilters.minimumIncomeGrowth,
    ),
    minimumGrossYield: numeric(
      search,
      "minimumGrossYield",
      defaultFilters.minimumGrossYield,
    ),
    maximumVacancy: numeric(
      search,
      "maximumVacancy",
      defaultFilters.maximumVacancy,
    ),
    sort:
      requestedSort && SORTS.has(requestedSort)
        ? requestedSort
        : defaultFilters.sort,
    sortDirection:
      requestedDirection && SORT_DIRECTIONS.has(requestedDirection)
        ? requestedDirection
        : defaultFilters.sortDirection,
    strategyKey: search.get("strategyKey") ?? defaultFilters.strategyKey,
    strategyName: search.get("strategyName") ?? defaultFilters.strategyName,
    strategyVersion: Math.max(
      1,
      Math.floor(numeric(search, "strategyVersion", defaultFilters.strategyVersion)),
    ),
    strategyWeights: parseWeights(search.get("weights")),
  };
}

export function filtersToSearch(
  filters: ScreenerFilters,
  page = 1,
  pageSize = 20,
): URLSearchParams {
  return new URLSearchParams({
    search: filters.search,
    market: filters.city ?? defaultFilters.city,
    minimumScore: String(filters.minimumScore),
    minimumIncomeGrowth: String(filters.minimumIncomeGrowth),
    minimumGrossYield: String(filters.minimumGrossYield),
    maximumVacancy: String(filters.maximumVacancy),
    sort: filters.sort,
    sortDirection: filters.sortDirection,
    strategyKey: filters.strategyKey,
    strategyName: filters.strategyName,
    strategyVersion: String(filters.strategyVersion),
    weights: SCORE_KEYS.map((key) => filters.strategyWeights[key]).join(","),
    page: String(page),
    pageSize: String(pageSize),
  });
}
