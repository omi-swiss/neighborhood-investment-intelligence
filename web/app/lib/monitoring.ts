import type { AreaRecord } from "./types";
import type { PropertyWithDerived } from "./property-domain";

export const ALERT_EVENT_TYPES = [
  "new_property_listing",
  "price_reduction",
  "property_status_change",
  "neighborhood_score_change",
  "rent_trend_change",
  "vacancy_change",
  "regulation_change",
  "data_refresh",
] as const;

export type AlertEventType = (typeof ALERT_EVENT_TYPES)[number];
export type MonitoredEntityType = "area" | "property" | "search";

export const alertEventLabels: Record<AlertEventType, string> = {
  new_property_listing: "New property listing",
  price_reduction: "Price reduction",
  property_status_change: "Property status change",
  neighborhood_score_change: "Neighborhood score change",
  rent_trend_change: "Rent trend change",
  vacancy_change: "Vacancy change",
  regulation_change: "Regulation change",
  data_refresh: "Data refresh",
};

export const defaultEventsByEntity: Record<MonitoredEntityType, AlertEventType[]> = {
  area: [
    "neighborhood_score_change",
    "rent_trend_change",
    "vacancy_change",
    "regulation_change",
    "data_refresh",
  ],
  property: ["price_reduction", "property_status_change", "data_refresh"],
  search: ["new_property_listing", "data_refresh"],
};

export type MonitoringChange = {
  eventType: AlertEventType;
  title: string;
  previous: Record<string, unknown> | null;
  current: Record<string, unknown>;
  sourceName: string;
  sourceUrl: string | null;
  whyItMatters: string;
  fingerprintValue: string;
};

export function areaSnapshot(area: AreaRecord, release: string) {
  return {
    score: area.score,
    medianRent: area.metrics.medianGrossRent,
    vacancyRate: area.metrics.vacancyRate,
    release,
    sourceName: "U.S. Census Bureau ACS",
    sourceUrl: "https://www.census.gov/programs-surveys/acs",
  };
}

export function propertySnapshot(property: PropertyWithDerived) {
  return {
    askingPrice: property.askingPrice,
    listingStatus: property.listingStatus,
    updatedAt: property.updatedAt,
    sourceName: property.sourceName,
    sourceUrl: property.sourceUrl,
  };
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function detectMonitoringChanges(
  entityType: "area" | "property",
  label: string,
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): MonitoringChange[] {
  const changes: MonitoringChange[] = [];
  const sourceName = String(current.sourceName ?? "Workspace data");
  const sourceUrl = typeof current.sourceUrl === "string" ? current.sourceUrl : null;
  if (entityType === "property") {
    const previousPrice = numeric(previous.askingPrice);
    const currentPrice = numeric(current.askingPrice);
    if (previousPrice !== null && currentPrice !== null && currentPrice < previousPrice) {
      changes.push({
        eventType: "price_reduction",
        title: `${label}: price reduced`,
        previous: { askingPrice: previousPrice },
        current: { askingPrice: currentPrice },
        sourceName,
        sourceUrl,
        whyItMatters: "A lower asking price can change relative value, financing needs, and projected returns.",
        fingerprintValue: String(currentPrice),
      });
    }
    if (
      typeof previous.listingStatus === "string" &&
      typeof current.listingStatus === "string" &&
      previous.listingStatus !== current.listingStatus
    ) {
      changes.push({
        eventType: "property_status_change",
        title: `${label}: status changed`,
        previous: { listingStatus: previous.listingStatus },
        current: { listingStatus: current.listingStatus },
        sourceName,
        sourceUrl,
        whyItMatters: "A status change can affect availability, negotiation timing, and the reliability of the active opportunity.",
        fingerprintValue: String(current.listingStatus),
      });
    }
    if (previous.updatedAt !== current.updatedAt) {
      changes.push({
        eventType: "data_refresh",
        title: `${label}: property evidence refreshed`,
        previous: { updatedAt: previous.updatedAt ?? null },
        current: { updatedAt: current.updatedAt ?? null },
        sourceName,
        sourceUrl,
        whyItMatters: "Fresh source observations may change screening and underwriting inputs.",
        fingerprintValue: String(current.updatedAt),
      });
    }
  } else {
    const previousScore = numeric(previous.score);
    const currentScore = numeric(current.score);
    if (
      previousScore !== null &&
      currentScore !== null &&
      Math.abs(currentScore - previousScore) >= 1
    ) {
      changes.push({
        eventType: "neighborhood_score_change",
        title: `${label}: opportunity score changed`,
        previous: { score: previousScore },
        current: { score: currentScore },
        sourceName,
        sourceUrl,
        whyItMatters: "A score change can alter the area's rank under the current evidence and strategy.",
        fingerprintValue: String(currentScore),
      });
    }
    if (previous.medianRent !== current.medianRent) {
      changes.push({
        eventType: "rent_trend_change",
        title: `${label}: rent evidence changed`,
        previous: { medianRent: previous.medianRent ?? null },
        current: { medianRent: current.medianRent ?? null },
        sourceName,
        sourceUrl,
        whyItMatters: "Rent evidence affects income expectations and relative yield screening.",
        fingerprintValue: String(current.medianRent),
      });
    }
    const previousVacancy = numeric(previous.vacancyRate);
    const currentVacancy = numeric(current.vacancyRate);
    if (
      previousVacancy !== null &&
      currentVacancy !== null &&
      Math.abs(currentVacancy - previousVacancy) >= 0.005
    ) {
      changes.push({
        eventType: "vacancy_change",
        title: `${label}: vacancy changed`,
        previous: { vacancyRate: previousVacancy },
        current: { vacancyRate: currentVacancy },
        sourceName,
        sourceUrl,
        whyItMatters: "Vacancy affects rental demand, lease-up risk, and achievable operating income.",
        fingerprintValue: String(currentVacancy),
      });
    }
    if (previous.release !== current.release) {
      changes.push({
        eventType: "data_refresh",
        title: `${label}: neighborhood data refreshed`,
        previous: { release: previous.release ?? null },
        current: { release: current.release ?? null },
        sourceName,
        sourceUrl,
        whyItMatters: "A new data release may change trends, ranks, and strategy results.",
        fingerprintValue: String(current.release),
      });
    }
  }
  return changes;
}

export type PropertySearchQuery = {
  search?: string;
  propertyType?: string;
  maximumPrice?: number;
  minimumGrossYield?: number;
  minimumCompleteness?: number;
};

export function matchesPropertySearch(
  property: PropertyWithDerived,
  query: PropertySearchQuery,
) {
  const text = (query.search ?? "").trim().toLowerCase();
  const haystack = [
    property.address,
    property.city,
    property.county,
    property.state,
    property.postalCode,
  ].join(" ").toLowerCase();
  return (
    (!text || haystack.includes(text)) &&
    (!query.propertyType || property.propertyType === query.propertyType) &&
    property.askingPrice <= (Number.isFinite(query.maximumPrice) ? Number(query.maximumPrice) : Number.MAX_SAFE_INTEGER) &&
    (property.derived.grossYield ?? -1) >= (Number(query.minimumGrossYield) || 0) &&
    property.derived.dataCompleteness >= (Number(query.minimumCompleteness) || 0)
  );
}
