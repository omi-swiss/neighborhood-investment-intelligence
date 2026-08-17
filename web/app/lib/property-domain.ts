import type { properties } from "../../db/schema";
import { getArea } from "./areas";
import { PROPERTY_TYPES, type PropertyType } from "./property-types";
export { PROPERTY_TYPES, type PropertyType } from "./property-types";
export type PropertyRow = typeof properties.$inferSelect;
export type PropertyWithDerived = PropertyRow & { derived: PropertyDerived };

export type NormalizedPropertyInput = Omit<
  typeof properties.$inferInsert,
  "id" | "userEmail" | "importId" | "sourceName" | "sourceLicense" | "sourceUrl" | "createdAt" | "updatedAt"
>;

export type ImportRejection = { row: number; reason: string };

export type FavorabilityComponent = {
  key: string;
  label: string;
  value: string;
  benchmark: string;
  score: number | null;
  weight: number;
  direction: string;
  source: string;
  missingEffect: string;
};

export type PropertyDerived = {
  pricePerSquareFoot: number | null;
  grossYield: number | null;
  grossRentMultiplier: number | null;
  netOperatingIncomeProxy: number | null;
  capRateProxy: number | null;
  dataCompleteness: number;
  favorabilityScore: number | null;
  favorabilityStatus:
    | "Highly favorable"
    | "Favorable"
    | "Neutral"
    | "Unfavorable"
    | "Highly unfavorable"
    | "Insufficient data";
  confidence: "High" | "Medium" | "Low";
  components: FavorabilityComponent[];
  disclaimer: string;
};

const fieldAliases: Record<string, string[]> = {
  sourceRecordId: ["source_record_id", "listing_id"],
  address: ["address", "street_address"],
  city: ["city"],
  county: ["county"],
  state: ["state", "state_abbr"],
  postalCode: ["postal_code", "zip", "zip_code"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lon", "lng"],
  parcelId: ["parcel_id"],
  propertyType: ["property_type"],
  unitCount: ["unit_count", "units"],
  bedrooms: ["bedrooms", "beds"],
  bathrooms: ["bathrooms", "baths"],
  buildingSquareFeet: ["building_square_feet", "square_feet", "sqft"],
  lotSquareFeet: ["lot_square_feet", "lot_sqft"],
  yearBuilt: ["year_built"],
  askingPrice: ["asking_price", "list_price", "price"],
  currentMonthlyRent: ["current_monthly_rent", "current_rent"],
  marketMonthlyRent: ["market_monthly_rent", "market_rent"],
  annualPropertyTaxes: ["annual_property_taxes", "property_taxes"],
  annualInsurance: ["annual_insurance", "insurance"],
  hoaMonthly: ["hoa_monthly", "hoa"],
  maintenanceMonthly: ["maintenance_monthly", "maintenance"],
  vacancyAssumption: ["vacancy_assumption", "vacancy_rate"],
  renovationEstimate: ["renovation_estimate", "renovation"],
  listingDate: ["listing_date"],
  listingStatus: ["listing_status", "status"],
  broker: ["broker"],
  tractGeoid: ["tract_geoid", "census_tract"],
  observedAt: ["observed_at", "last_updated"],
};

function valueFor(row: Record<string, unknown>, field: string): unknown {
  const alias = fieldAliases[field]?.find((name) => name in row);
  return alias ? row[alias] : undefined;
}

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function numberValue(value: unknown): number | null {
  const normalized = stringValue(value);
  if (normalized === null) return null;
  const parsed = Number(normalized.replaceAll(",", "").replace(/^\$/, "").replace(/%$/, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function nonnegative(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

export function normalizePropertyInput(
  raw: unknown,
  rowNumber: number,
): { value?: NormalizedPropertyInput; rejection?: ImportRejection } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { rejection: { row: rowNumber, reason: "Row must be an object." } };
  }
  const row = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
      key.trim().toLowerCase(),
      value,
    ]),
  );
  const sourceRecordId = stringValue(valueFor(row, "sourceRecordId"));
  const address = stringValue(valueFor(row, "address"));
  const city = stringValue(valueFor(row, "city"));
  const state = stringValue(valueFor(row, "state"))?.toUpperCase();
  const propertyType = stringValue(valueFor(row, "propertyType")) as PropertyType | null;
  const askingPrice = numberValue(valueFor(row, "askingPrice"));
  if (!sourceRecordId || !address || !city || !state || !propertyType || askingPrice === null) {
    return {
      rejection: {
        row: rowNumber,
        reason: "source_record_id, address, city, state, property_type, and asking_price are required.",
      },
    };
  }
  if (!PROPERTY_TYPES.includes(propertyType)) {
    return { rejection: { row: rowNumber, reason: `Unsupported property_type: ${propertyType}.` } };
  }
  if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
    return { rejection: { row: rowNumber, reason: "asking_price must be greater than zero." } };
  }

  const latitude = numberValue(valueFor(row, "latitude"));
  const longitude = numberValue(valueFor(row, "longitude"));
  const unitCount = numberValue(valueFor(row, "unitCount")) ?? 1;
  const bedrooms = numberValue(valueFor(row, "bedrooms"));
  const bathrooms = numberValue(valueFor(row, "bathrooms"));
  const buildingSquareFeet = numberValue(valueFor(row, "buildingSquareFeet"));
  const lotSquareFeet = numberValue(valueFor(row, "lotSquareFeet"));
  const yearBuilt = numberValue(valueFor(row, "yearBuilt"));
  const currentMonthlyRent = numberValue(valueFor(row, "currentMonthlyRent"));
  const marketMonthlyRent = numberValue(valueFor(row, "marketMonthlyRent"));
  const annualPropertyTaxes = numberValue(valueFor(row, "annualPropertyTaxes"));
  const annualInsurance = numberValue(valueFor(row, "annualInsurance"));
  const hoaMonthly = numberValue(valueFor(row, "hoaMonthly"));
  const maintenanceMonthly = numberValue(valueFor(row, "maintenanceMonthly"));
  let vacancyAssumption = numberValue(valueFor(row, "vacancyAssumption"));
  const renovationEstimate = numberValue(valueFor(row, "renovationEstimate"));
  if (vacancyAssumption !== null && vacancyAssumption > 1 && vacancyAssumption <= 100) {
    vacancyAssumption /= 100;
  }
  const numericValues = [
    unitCount,
    bedrooms,
    bathrooms,
    buildingSquareFeet,
    lotSquareFeet,
    currentMonthlyRent,
    marketMonthlyRent,
    annualPropertyTaxes,
    annualInsurance,
    hoaMonthly,
    maintenanceMonthly,
    renovationEstimate,
  ];
  if (numericValues.some((value) => !nonnegative(value))) {
    return { rejection: { row: rowNumber, reason: "Numeric property values cannot be negative or invalid." } };
  }
  if (
    (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
  ) {
    return { rejection: { row: rowNumber, reason: "Coordinates fall outside valid latitude/longitude ranges." } };
  }
  if (!Number.isInteger(unitCount) || unitCount < 1) {
    return { rejection: { row: rowNumber, reason: "unit_count must be a positive integer." } };
  }
  if (vacancyAssumption !== null && (!Number.isFinite(vacancyAssumption) || vacancyAssumption < 0 || vacancyAssumption > 1)) {
    return { rejection: { row: rowNumber, reason: "vacancy_assumption must be between 0 and 1 (or 0 and 100%)." } };
  }
  if (yearBuilt !== null && (!Number.isInteger(yearBuilt) || yearBuilt < 1600 || yearBuilt > new Date().getFullYear() + 2)) {
    return { rejection: { row: rowNumber, reason: "year_built is outside the supported range." } };
  }
  const observedAt = stringValue(valueFor(row, "observedAt")) ?? new Date().toISOString().slice(0, 10);
  return {
    value: {
      sourceRecordId,
      address,
      city,
      county: stringValue(valueFor(row, "county")),
      state,
      postalCode: stringValue(valueFor(row, "postalCode")),
      latitude,
      longitude,
      parcelId: stringValue(valueFor(row, "parcelId")),
      propertyType,
      unitCount,
      bedrooms,
      bathrooms,
      buildingSquareFeet: buildingSquareFeet === null ? null : Math.round(buildingSquareFeet),
      lotSquareFeet: lotSquareFeet === null ? null : Math.round(lotSquareFeet),
      yearBuilt,
      askingPrice,
      currentMonthlyRent,
      marketMonthlyRent,
      annualPropertyTaxes,
      annualInsurance,
      hoaMonthly,
      maintenanceMonthly,
      vacancyAssumption,
      renovationEstimate,
      listingDate: stringValue(valueFor(row, "listingDate")),
      listingStatus: stringValue(valueFor(row, "listingStatus")) ?? "active",
      broker: stringValue(valueFor(row, "broker")),
      tractGeoid: stringValue(valueFor(row, "tractGeoid")),
      observedAt,
    },
  };
}

function clippedScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
}

function money(value: number | null): string {
  return value === null ? "Missing" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function percent(value: number | null): string {
  return value === null ? "Missing" : new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export async function deriveProperty(row: PropertyRow): Promise<PropertyDerived> {
  const rent = row.marketMonthlyRent ?? row.currentMonthlyRent;
  const pricePerSquareFoot =
    row.buildingSquareFeet && row.buildingSquareFeet > 0
      ? row.askingPrice / row.buildingSquareFeet
      : null;
  const grossYield = rent !== null && row.askingPrice > 0 ? (rent * 12) / row.askingPrice : null;
  const grossRentMultiplier = rent !== null && rent > 0 ? row.askingPrice / (rent * 12) : null;
  const annualGrossRent = rent === null ? null : rent * 12;
  const recurringExpenses =
    row.annualPropertyTaxes !== null &&
    row.annualInsurance !== null &&
    row.hoaMonthly !== null &&
    row.maintenanceMonthly !== null
      ? row.annualPropertyTaxes +
        row.annualInsurance +
        row.hoaMonthly * 12 +
        row.maintenanceMonthly * 12
      : null;
  const netOperatingIncomeProxy =
    annualGrossRent !== null && recurringExpenses !== null
      ? annualGrossRent * (1 - (row.vacancyAssumption ?? 0)) - recurringExpenses
      : null;
  const capRateProxy =
    netOperatingIncomeProxy !== null ? netOperatingIncomeProxy / row.askingPrice : null;
  const area = row.tractGeoid ? await getArea(row.tractGeoid) : undefined;
  const completenessFields = [
    row.latitude,
    row.longitude,
    row.buildingSquareFeet,
    rent,
    row.annualPropertyTaxes,
    row.annualInsurance,
    row.hoaMonthly,
    row.maintenanceMonthly,
    row.vacancyAssumption,
    row.tractGeoid,
  ];
  const dataCompleteness =
    completenessFields.filter((value) => value !== null && value !== undefined && value !== "").length /
    completenessFields.length;
  const components: FavorabilityComponent[] = [
    {
      key: "rentToPrice",
      label: "Rent-to-price",
      value: percent(grossYield),
      benchmark: "10% gross yield maps to component score 100; no market comp claim",
      score: grossYield === null ? null : clippedScore(grossYield * 1000),
      weight: 0.4,
      direction: "Higher is favorable",
      source: rent === row.marketMonthlyRent ? "Imported market rent" : "Imported current rent",
      missingEffect: "Excluded when rent is missing",
    },
    {
      key: "areaOpportunity",
      label: "Neighborhood opportunity",
      value: area?.score?.toFixed(1) ?? "Missing",
      benchmark: "Balanced percentile in the currently supported tract cohort",
      score: area?.score ?? null,
      weight: 0.35,
      direction: "Higher is favorable",
      source: area ? "ACS 2023 area evidence" : "No supported tract match",
      missingEffect: "Excluded when tract_geoid is absent or unsupported",
    },
    {
      key: "expenseCoverage",
      label: "Recurring-expense coverage",
      value: money(netOperatingIncomeProxy),
      benchmark: "NOI proxy / gross rent; excludes debt service and capital expenditures",
      score:
        netOperatingIncomeProxy !== null && annualGrossRent && annualGrossRent > 0
          ? clippedScore((netOperatingIncomeProxy / annualGrossRent) * 100)
          : null,
      weight: 0.15,
      direction: "Higher retained income is favorable",
      source: "Imported rent, tax, insurance, HOA, maintenance, and vacancy",
      missingEffect: "Excluded unless all recurring inputs are present",
    },
    {
      key: "dataCompleteness",
      label: "Data completeness",
      value: percent(dataCompleteness),
      benchmark: "Ten decision-useful fields in the property import contract",
      score: clippedScore(dataCompleteness * 100),
      weight: 0.1,
      direction: "Higher is favorable",
      source: "Import validation",
      missingEffect: "Always included and lowers confidence when inputs are absent",
    },
  ];
  const available = components.filter((component) => component.score !== null);
  const availableDecisionComponents = components
    .filter((component) => component.key !== "dataCompleteness")
    .filter((component) => component.score !== null);
  const totalWeight = available.reduce((sum, component) => sum + component.weight, 0);
  const favorabilityScore =
    availableDecisionComponents.length < 2
      ? null
      : Math.round(
          (available.reduce((sum, component) => sum + component.score! * component.weight, 0) /
            totalWeight) *
            10,
        ) / 10;
  const favorabilityStatus =
    favorabilityScore === null
      ? "Insufficient data"
      : favorabilityScore >= 80
        ? "Highly favorable"
        : favorabilityScore >= 65
          ? "Favorable"
          : favorabilityScore >= 45
            ? "Neutral"
            : favorabilityScore >= 30
              ? "Unfavorable"
              : "Highly unfavorable";
  const confidence = dataCompleteness >= 0.8 ? "High" : dataCompleteness >= 0.55 ? "Medium" : "Low";
  return {
    pricePerSquareFoot,
    grossYield,
    grossRentMultiplier,
    netOperatingIncomeProxy,
    capRateProxy,
    dataCompleteness,
    favorabilityScore,
    favorabilityStatus,
    confidence,
    components,
    disclaimer:
      "Screening signal only. It is not an appraisal or full underwriting model; independently verify every property fact and expense.",
  };
}
