export type TrendPoint = {
  year: number;
  population: number | null;
  income: number | null;
  rent: number | null;
  homeValue: number | null;
  vacancyRate: number | null;
  warning: string | null;
};

export type AreaMetrics = {
  population: number | null;
  householdCount: number | null;
  medianAge: number | null;
  populationGrowth: number | null;
  medianHouseholdIncome: number | null;
  incomeGrowth: number | null;
  medianGrossRent: number | null;
  medianHomeValue: number | null;
  grossYieldProxy: number | null;
  vacancyRate: number | null;
  renterShare: number | null;
  unemploymentRate: number | null;
  povertyRate: number | null;
  metricCoverage: number | null;
};

export type ScoreKey =
  | "demographicMomentum"
  | "incomeMomentum"
  | "rentalStrength"
  | "housingDemand"
  | "riskResilience"
  | "dataReliability";

export type StrategyWeights = Record<ScoreKey, number>;

export type StrategyDefinition = {
  key: string;
  name: string;
  description?: string;
  version: number;
  weights: StrategyWeights;
  minimumCoverage: number;
  owner: "system" | "user";
};

export type AreaRecord = {
  id: string;
  /** Canonical current-vintage Census tract GEOID. `id` remains a compatibility alias. */
  tractGeoid?: string;
  marketId: string;
  name: string;
  tractLabel: string;
  neighborhood: string | null;
  nameSource: string;
  nameConfidence: "high" | "medium" | "low";
  nameObservationCount: number;
  county: string;
  /** County or county-equivalent GEOID when the source artifact supplies it. */
  countyGeoid?: string;
  countyType?: "county" | "county_equivalent";
  neighborhoodId?: string | null;
  neighborhoodType?: "neighborhood" | "planning_area" | null;
  state: string;
  stateAbbr: string;
  city: string;
  metro: string;
  latitude: number | null;
  longitude: number | null;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  /** Boundary vintage rendered on the map; may differ from metric geography. */
  geometryVintage?: string;
  score: number | null;
  scores: Record<ScoreKey, number | null>;
  metrics: AreaMetrics;
  quality: {
    status: string;
    populationReliability: string;
    incomeReliability: string;
    warning: string;
  };
  trends: TrendPoint[];
};

export type Coverage = {
  label: string;
  city: string;
  metro: string;
  geographicLevel: string;
  scoreReferenceYear: number;
  trendStartYear: number;
  geographyVintage: string;
  areaCount: number;
};

export type Methodology = {
  scoreVersion: string;
  source: string;
  sourceUrl: string;
  availableAt: string;
  observationType: string;
  limitations: string[];
};

export type AreaDataset = {
  generatedAt: string;
  coverage: Coverage;
  methodology: Methodology;
  markets: MarketDefinition[];
  benchmarks: {
    city: CohortBenchmark;
    metro: CohortBenchmark;
    byCity: Record<string, CohortBenchmark>;
    byMetro: Record<string, CohortBenchmark>;
  };
  areas: AreaRecord[];
};

export type MarketDefinition = {
  id: string;
  cityGeoid: string;
  city: string;
  state: string;
  stateAbbr: string;
  metroGeoid: string;
  metro: string;
  label: string;
  geographyType: "place" | "metro";
  enabled: boolean;
  areaCount: number;
  coverageStatus: "integrated" | "planned" | "unavailable";
};

/** Lightweight, derived map-atlas record. It intentionally carries no tract geometry or metrics. */
export type MarketMapSummary = {
  marketId: string;
  city: string;
  stateAbbr: string;
  latitude: number;
  longitude: number;
  tractCount: number;
  averageScore: number | null;
};

export type CohortBenchmark = {
  name: string;
  areaCount: number;
  medianHouseholdIncome: number | null;
  medianHomeValue: number | null;
  medianGrossRent: number | null;
  vacancyRate: number | null;
  renterShare: number | null;
};

export type SortKey =
  | "area"
  | "score"
  | "medianHouseholdIncome"
  | "medianHomeValue"
  | "incomeGrowth"
  | "populationGrowth"
  | "grossYieldProxy"
  | "vacancyRate"
  | "metricCoverage";

export type SortDirection = "asc" | "desc";

export type MarketFocus = "all" | `place:${string}` | `metro:${string}`;

export type ScreenerFilters = {
  search: string;
  city: MarketFocus;
  minimumScore: number;
  minimumIncomeGrowth: number;
  minimumGrossYield: number;
  maximumVacancy: number;
  sort: SortKey;
  sortDirection: SortDirection;
  strategyKey: string;
  strategyName: string;
  strategyVersion: number;
  strategyWeights: StrategyWeights;
};
