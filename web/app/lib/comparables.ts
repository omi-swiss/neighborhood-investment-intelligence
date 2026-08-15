import type {
  properties,
  propertyComparableRecords,
  propertyComparableSelections,
} from "../../db/schema";
import { PROPERTY_TYPES, type PropertyType } from "./property-types";

export const COMPARABLE_TYPES = ["sale", "rental"] as const;
export type ComparableType = (typeof COMPARABLE_TYPES)[number];
export type ComparableRecord = typeof propertyComparableRecords.$inferSelect;
export type ComparableSelection = typeof propertyComparableSelections.$inferSelect;
export type ComparableInsert = Omit<
  typeof propertyComparableRecords.$inferInsert,
  | "id"
  | "userEmail"
  | "sourceName"
  | "sourceLicense"
  | "sourceUrl"
  | "createdAt"
  | "updatedAt"
>;
export type SubjectProperty = typeof properties.$inferSelect;

export type ComparableFilters = {
  radiusMiles: number;
  sameTractOnly: boolean;
  samePropertyType: boolean;
  maximumUnitDifference: number;
  sizeTolerance: number;
  ageToleranceYears: number;
  maximumAgeMonths: number;
};

export const defaultComparableFilters: ComparableFilters = {
  radiusMiles: 2,
  sameTractOnly: false,
  samePropertyType: true,
  maximumUnitDifference: 2,
  sizeTolerance: 0.35,
  ageToleranceYears: 25,
  maximumAgeMonths: 36,
};

export type ComparableCandidate = ComparableRecord & {
  distanceMiles: number | null;
  matchScore: number;
  included: boolean;
  decision: "automatic" | "include" | "exclude";
  adjustmentPercent: number;
  adjustmentNotes: string | null;
  adjustedValue: number;
  adjustmentBasis: string;
  matchReasons: string[];
};

export type ComparableAnalysis = {
  comparableType: ComparableType;
  candidates: ComparableCandidate[];
  included: ComparableCandidate[];
  estimate: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  subjectValue: number | null;
  discountPremium: number | null;
  relativePricingStatus:
    | "Highly favorable"
    | "Favorable"
    | "Neutral"
    | "Unfavorable"
    | "Highly unfavorable"
    | "Insufficient data";
  confidence: "High" | "Medium" | "Low" | "Insufficient";
  methodology: string;
  warnings: string[];
};

const aliases: Record<string, string[]> = {
  comparableType: ["comparable_type", "comp_type", "record_type"],
  sourceRecordId: ["source_record_id", "listing_id", "transaction_id"],
  address: ["address", "street_address"],
  city: ["city"],
  county: ["county"],
  state: ["state", "state_abbr"],
  postalCode: ["postal_code", "zip", "zip_code"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lon", "lng"],
  parcelId: ["parcel_id"],
  tractGeoid: ["tract_geoid", "census_tract"],
  propertyType: ["property_type"],
  unitCount: ["unit_count", "units"],
  bedrooms: ["bedrooms", "beds"],
  bathrooms: ["bathrooms", "baths"],
  buildingSquareFeet: ["building_square_feet", "square_feet", "sqft"],
  yearBuilt: ["year_built"],
  condition: ["condition"],
  transactionDate: ["transaction_date", "sale_date", "lease_date"],
  salePrice: ["sale_price", "closed_price"],
  monthlyRent: ["monthly_rent", "contract_rent", "asking_rent"],
  observedAt: ["observed_at", "last_updated"],
};

function rawValue(row: Record<string, unknown>, key: string) {
  const alias = aliases[key]?.find((candidate) => candidate in row);
  return alias ? row[alias] : undefined;
}

function stringValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function numberValue(value: unknown): number | null {
  const normalized = stringValue(value);
  if (normalized === null) return null;
  const parsed = Number(normalized.replaceAll(",", "").replace(/^\$/, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)));
}

export function normalizeComparableInput(
  raw: unknown,
  rowNumber: number,
): { value?: ComparableInsert; rejection?: { row: number; reason: string } } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { rejection: { row: rowNumber, reason: "Row must be an object." } };
  }
  const row = Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
      key.trim().toLowerCase(),
      value,
    ]),
  );
  const comparableType = stringValue(rawValue(row, "comparableType")) as ComparableType | null;
  const sourceRecordId = stringValue(rawValue(row, "sourceRecordId"));
  const address = stringValue(rawValue(row, "address"));
  const city = stringValue(rawValue(row, "city"));
  const state = stringValue(rawValue(row, "state"))?.toUpperCase() ?? null;
  const propertyType = stringValue(rawValue(row, "propertyType")) as PropertyType | null;
  const transactionDate = stringValue(rawValue(row, "transactionDate"));
  if (
    !comparableType ||
    !sourceRecordId ||
    !address ||
    !city ||
    !state ||
    !propertyType ||
    !transactionDate
  ) {
    return {
      rejection: {
        row: rowNumber,
        reason:
          "comparable_type, source_record_id, address, city, state, property_type, and transaction_date are required.",
      },
    };
  }
  if (!COMPARABLE_TYPES.includes(comparableType)) {
    return { rejection: { row: rowNumber, reason: "comparable_type must be sale or rental." } };
  }
  if (!PROPERTY_TYPES.includes(propertyType)) {
    return { rejection: { row: rowNumber, reason: `Unsupported property_type: ${propertyType}.` } };
  }
  if (!validDate(transactionDate)) {
    return { rejection: { row: rowNumber, reason: "transaction_date must be YYYY-MM-DD." } };
  }
  if (new Date(`${transactionDate}T00:00:00Z`).getTime() > Date.now() + 86_400_000) {
    return { rejection: { row: rowNumber, reason: "transaction_date cannot be in the future." } };
  }
  if (
    sourceRecordId.length > 160 ||
    address.length > 240 ||
    city.length > 120 ||
    state.length > 32
  ) {
    return { rejection: { row: rowNumber, reason: "Comparable identity fields exceed supported lengths." } };
  }
  const salePrice = numberValue(rawValue(row, "salePrice"));
  const monthlyRent = numberValue(rawValue(row, "monthlyRent"));
  if (comparableType === "sale" && (salePrice === null || !Number.isFinite(salePrice) || salePrice <= 0)) {
    return { rejection: { row: rowNumber, reason: "sale comparables require a positive sale_price." } };
  }
  if (comparableType === "rental" && (monthlyRent === null || !Number.isFinite(monthlyRent) || monthlyRent <= 0)) {
    return { rejection: { row: rowNumber, reason: "rental comparables require a positive monthly_rent." } };
  }
  const latitude = numberValue(rawValue(row, "latitude"));
  const longitude = numberValue(rawValue(row, "longitude"));
  if (
    (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
    (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
  ) {
    return { rejection: { row: rowNumber, reason: "Coordinates are outside valid ranges." } };
  }
  const unitCount = numberValue(rawValue(row, "unitCount")) ?? 1;
  const buildingSquareFeet = numberValue(rawValue(row, "buildingSquareFeet"));
  const yearBuilt = numberValue(rawValue(row, "yearBuilt"));
  const bedrooms = numberValue(rawValue(row, "bedrooms"));
  const bathrooms = numberValue(rawValue(row, "bathrooms"));
  if (!Number.isInteger(unitCount) || unitCount < 1) {
    return { rejection: { row: rowNumber, reason: "unit_count must be a positive integer." } };
  }
  if (
    [buildingSquareFeet, bedrooms, bathrooms].some(
      (value) => value !== null && (!Number.isFinite(value) || value < 0),
    )
  ) {
    return { rejection: { row: rowNumber, reason: "Property measurements cannot be negative." } };
  }
  if (
    yearBuilt !== null &&
    (!Number.isInteger(yearBuilt) || yearBuilt < 1600 || yearBuilt > new Date().getFullYear() + 2)
  ) {
    return { rejection: { row: rowNumber, reason: "year_built is outside the supported range." } };
  }
  const observedAt = stringValue(rawValue(row, "observedAt")) ?? transactionDate;
  if (!validDate(observedAt)) {
    return { rejection: { row: rowNumber, reason: "observed_at must be YYYY-MM-DD." } };
  }
  const condition = stringValue(rawValue(row, "condition"));
  if ((condition?.length ?? 0) > 160) {
    return { rejection: { row: rowNumber, reason: "condition must be 160 characters or fewer." } };
  }
  return {
    value: {
      comparableType,
      sourceRecordId,
      address,
      city,
      county: stringValue(rawValue(row, "county")),
      state,
      postalCode: stringValue(rawValue(row, "postalCode")),
      latitude,
      longitude,
      parcelId: stringValue(rawValue(row, "parcelId")),
      tractGeoid: stringValue(rawValue(row, "tractGeoid")),
      propertyType,
      unitCount,
      bedrooms,
      bathrooms,
      buildingSquareFeet: buildingSquareFeet === null ? null : Math.round(buildingSquareFeet),
      yearBuilt,
      condition,
      transactionDate,
      salePrice,
      monthlyRent,
      observedAt,
    },
  };
}

function haversineMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function quantile(values: number[], quantileValue: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * quantileValue;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function monthsBetween(date: string, referenceDate: Date) {
  const value = new Date(`${date}T00:00:00Z`);
  return Math.max(
    0,
    (referenceDate.getUTCFullYear() - value.getUTCFullYear()) * 12 +
      referenceDate.getUTCMonth() -
      value.getUTCMonth(),
  );
}

function scaledComparableValue(
  subject: SubjectProperty,
  comparable: ComparableRecord,
  comparableType: ComparableType,
) {
  const observedValue =
    comparableType === "sale" ? comparable.salePrice! : comparable.monthlyRent!;
  if (
    subject.buildingSquareFeet &&
    comparable.buildingSquareFeet &&
    comparable.buildingSquareFeet > 0
  ) {
    return {
      value: observedValue * subject.buildingSquareFeet / comparable.buildingSquareFeet,
      basis: "Scaled by building square footage",
    };
  }
  if (subject.unitCount > 0 && comparable.unitCount > 0) {
    return {
      value: observedValue * subject.unitCount / comparable.unitCount,
      basis: "Scaled by unit count",
    };
  }
  return { value: observedValue, basis: "Unadjusted observed value" };
}

export function analyzeComparables({
  subject,
  records,
  selections,
  comparableType,
  filters = defaultComparableFilters,
  referenceDate = new Date(),
}: {
  subject: SubjectProperty;
  records: ComparableRecord[];
  selections: ComparableSelection[];
  comparableType: ComparableType;
  filters?: ComparableFilters;
  referenceDate?: Date;
}): ComparableAnalysis {
  const selectionByRecord = new Map(
    selections.map((selection) => [selection.comparableRecordId, selection]),
  );
  const candidates: ComparableCandidate[] = [];
  for (const record of records.filter((item) => item.comparableType === comparableType)) {
    const selection = selectionByRecord.get(record.id);
    const decision = (selection?.decision ?? "automatic") as ComparableCandidate["decision"];
    const distanceMiles =
      subject.latitude !== null &&
      subject.longitude !== null &&
      record.latitude !== null &&
      record.longitude !== null
        ? haversineMiles(subject.latitude, subject.longitude, record.latitude, record.longitude)
        : null;
    const sameTract = Boolean(subject.tractGeoid && subject.tractGeoid === record.tractGeoid);
    const samePostal = Boolean(subject.postalCode && subject.postalCode === record.postalCode);
    const sameCity =
      subject.city.toLowerCase() === record.city.toLowerCase() &&
      subject.state.toLowerCase() === record.state.toLowerCase();
    const ageMonths = monthsBetween(record.transactionDate, referenceDate);
    const sizeDifference =
      subject.buildingSquareFeet && record.buildingSquareFeet
        ? Math.abs(subject.buildingSquareFeet - record.buildingSquareFeet) /
          subject.buildingSquareFeet
        : null;
    const yearDifference =
      subject.yearBuilt && record.yearBuilt
        ? Math.abs(subject.yearBuilt - record.yearBuilt)
        : null;
    const automaticPass =
      record.state.toLowerCase() === subject.state.toLowerCase() &&
      (!filters.sameTractOnly || sameTract) &&
      (!filters.samePropertyType || record.propertyType === subject.propertyType) &&
      Math.abs(record.unitCount - subject.unitCount) <= filters.maximumUnitDifference &&
      (sizeDifference === null || sizeDifference <= filters.sizeTolerance) &&
      (yearDifference === null || yearDifference <= filters.ageToleranceYears) &&
      ageMonths <= filters.maximumAgeMonths &&
      (distanceMiles === null || distanceMiles <= filters.radiusMiles) &&
      (sameTract || samePostal || sameCity || distanceMiles !== null);
    const included = decision === "include" || (decision === "automatic" && automaticPass);
    const geographyScore = sameTract
      ? 1
      : samePostal
        ? 0.85
        : distanceMiles !== null
          ? Math.max(0, 1 - distanceMiles / Math.max(filters.radiusMiles, 0.1))
          : sameCity
            ? 0.55
            : 0;
    const typeScore = record.propertyType === subject.propertyType ? 1 : 0;
    const unitScore = Math.max(
      0,
      1 - Math.abs(record.unitCount - subject.unitCount) /
        Math.max(filters.maximumUnitDifference + 1, 1),
    );
    const sizeScore = sizeDifference === null ? 0.5 : Math.max(0, 1 - sizeDifference);
    const ageScore =
      yearDifference === null ? 0.5 : Math.max(0, 1 - yearDifference / 100);
    const recencyScore = Math.max(0, 1 - ageMonths / Math.max(filters.maximumAgeMonths, 1));
    const matchScore =
      geographyScore * 0.25 +
      typeScore * 0.2 +
      unitScore * 0.15 +
      sizeScore * 0.15 +
      ageScore * 0.1 +
      recencyScore * 0.15;
    const scaled = scaledComparableValue(subject, record, comparableType);
    const adjustmentPercent = selection?.adjustmentPercent ?? 0;
    candidates.push({
      ...record,
      distanceMiles,
      matchScore,
      included: decision === "exclude" ? false : included,
      decision,
      adjustmentPercent,
      adjustmentNotes: selection?.adjustmentNotes ?? null,
      adjustedValue: scaled.value * (1 + adjustmentPercent),
      adjustmentBasis: scaled.basis,
      matchReasons: [
        sameTract ? "Same tract" : samePostal ? "Same ZIP" : sameCity ? "Same city" : "Other geography",
        record.propertyType === subject.propertyType ? "Same property type" : "Different property type",
        `${ageMonths} months old`,
      ],
    });
  }
  candidates.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1;
    return b.matchScore - a.matchScore;
  });
  const included = candidates.filter((candidate) => candidate.included);
  const adjustedValues = included.map((candidate) => candidate.adjustedValue);
  const estimate = quantile(adjustedValues, 0.5);
  const subjectValue =
    comparableType === "sale"
      ? subject.askingPrice
      : subject.marketMonthlyRent ?? subject.currentMonthlyRent;
  const averageMatch =
    included.length
      ? included.reduce((sum, candidate) => sum + candidate.matchScore, 0) / included.length
      : 0;
  const confidence =
    included.length >= 5 && averageMatch >= 0.7
      ? "High"
      : included.length >= 3 && averageMatch >= 0.5
        ? "Medium"
        : included.length
          ? "Low"
          : "Insufficient";
  const warnings: string[] = [];
  if (!included.length) warnings.push(`No ${comparableType} records meet the current rules.`);
  if (included.some((candidate) => candidate.decision === "include" && candidate.matchScore < 0.4)) {
    warnings.push("One or more manually included records have a weak automatic match.");
  }
  if (included.some((candidate) => candidate.condition === null)) {
    warnings.push("Condition is missing for one or more included records; no condition adjustment was inferred.");
  }
  const discountPremium =
    estimate !== null && subjectValue !== null && estimate !== 0
      ? (subjectValue - estimate) / estimate
      : null;
  const favorableSpread =
    discountPremium === null
      ? null
      : comparableType === "sale"
        ? -discountPremium
        : discountPremium;
  const relativePricingStatus =
    favorableSpread === null
      ? "Insufficient data"
      : favorableSpread >= 0.1
        ? "Highly favorable"
        : favorableSpread >= 0.03
          ? "Favorable"
          : favorableSpread > -0.03
            ? "Neutral"
            : favorableSpread > -0.1
              ? "Unfavorable"
              : "Highly unfavorable";
  return {
    comparableType,
    candidates,
    included,
    estimate,
    rangeLow: quantile(adjustedValues, 0.25),
    rangeHigh: quantile(adjustedValues, 0.75),
    subjectValue,
    discountPremium,
    relativePricingStatus,
    confidence,
    methodology:
      "Median estimate with an interquartile range. Values are scaled by subject/comparable square footage when available, then unit count, and finally any explicit manual adjustment.",
    warnings,
  };
}
