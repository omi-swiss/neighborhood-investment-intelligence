export type InvestorContext = {
  version: 1;
  marketId?: string;
  countyGeoid?: string;
  neighborhoodId?: string;
  tractGeoid?: string;
  propertyId?: number;
  sourceRecordId?: string;
  strategyVersion?: number;
  returnTo?: string;
};

const INTERNAL_PATH = /^\/(?!\/)/;

function text(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function geoid(value: string | null, length: number): string | undefined {
  const candidate = text(value);
  return candidate && new RegExp(`^\\d{${length}}$`).test(candidate) ? candidate : undefined;
}

export function contextFromSearch(search: URLSearchParams): InvestorContext {
  const propertyId = Number(search.get("propertyId"));
  const strategyVersion = Number(search.get("strategyVersion"));
  const returnTo = text(search.get("returnTo"));
  return {
    version: 1,
    marketId: text(search.get("marketId")),
    countyGeoid: geoid(search.get("countyGeoid"), 5),
    neighborhoodId: text(search.get("neighborhoodId")),
    tractGeoid: geoid(search.get("tractGeoid"), 11),
    propertyId: Number.isInteger(propertyId) && propertyId > 0 ? propertyId : undefined,
    sourceRecordId: text(search.get("sourceRecordId")),
    strategyVersion: Number.isInteger(strategyVersion) && strategyVersion > 0 ? strategyVersion : undefined,
    returnTo: returnTo && INTERNAL_PATH.test(returnTo) ? returnTo : undefined,
  };
}

export function contextToSearch(context: InvestorContext): URLSearchParams {
  const params = new URLSearchParams();
  params.set("contextVersion", "1");
  if (context.marketId) params.set("marketId", context.marketId);
  if (context.countyGeoid) params.set("countyGeoid", context.countyGeoid);
  if (context.neighborhoodId) params.set("neighborhoodId", context.neighborhoodId);
  if (context.tractGeoid) params.set("tractGeoid", context.tractGeoid);
  if (context.propertyId) params.set("propertyId", String(context.propertyId));
  if (context.sourceRecordId) params.set("sourceRecordId", context.sourceRecordId);
  if (context.strategyVersion) params.set("strategyVersion", String(context.strategyVersion));
  if (context.returnTo && INTERNAL_PATH.test(context.returnTo)) params.set("returnTo", context.returnTo);
  return params;
}

export function appendContext(path: string, context: InvestorContext): string {
  const params = contextToSearch(context);
  return params.size ? `${path}${path.includes("?") ? "&" : "?"}${params}` : path;
}
