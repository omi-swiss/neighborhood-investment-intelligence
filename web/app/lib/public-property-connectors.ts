import type { PropertyMarketDirectoryEntry } from "../data/property-markets";
import type { QualifiedSale } from "./remaining-gaps";

const PAGE_SIZE = 12;
const EXTERNAL_TIMEOUT_MS = 9_000;

type LookupResult = {
  items: QualifiedSale[];
  total: number;
  totalIsLowerBound?: boolean;
  sourceUrl: string;
  sourceName: string;
};

type ArcGisFeature = { attributes?: Record<string, unknown> };
type ArcGisPayload = { features?: ArcGisFeature[]; count?: number; error?: { message?: string } };

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text && text !== "N/A" ? text : null;
}

function cleanNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function cleanYear(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1700 && parsed <= new Date().getFullYear() + 1
    ? parsed
    : null;
}

function arcGisDate(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const date = new Date(parsed);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

function isoDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

function safeQuery(value: string) {
  return value
    .trim()
    .slice(0, 100)
    .toUpperCase()
    .replace(/[^A-Z0-9 .#/-]/g, " ")
    .replace(/\s+/g, " ");
}

function officialPropertyDetailUrl(market: PropertyMarketDirectoryEntry, parcelId: string) {
  const id = parcelId.trim();
  if (!id || id === "Parcel ID unavailable") return market.officialSourceUrl;
  const encodedId = encodeURIComponent(id);
  switch (market.city) {
    case "Detroit":
      return `https://cityofdetroit.github.io/parcel-viewer/${encodedId}`;
    case "Boston":
      return `https://www.cityofboston.gov/assessing/search/?pid=${encodedId}`;
    case "Tampa":
      return `https://gis.hcpafl.org/propertysearch/#/parcel/basic/${encodedId}`;
    case "Chicago":
      return `https://www.cookcountyassessoril.gov/pin/${encodedId}`;
    default:
      return market.officialSourceUrl;
  }
}

async function fetchJson<T>(url: string, params: URLSearchParams) {
  const response = await fetch(`${url}?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Official property source returned ${response.status}.`);
  return response.json() as Promise<T>;
}

async function arcGisLookup({
  url,
  where,
  fields,
  page,
  normalize,
}: {
  url: string;
  where: string;
  fields: string;
  page: number;
  normalize: (attributes: Record<string, unknown>) => QualifiedSale;
}): Promise<{ items: QualifiedSale[]; total: number }> {
  const offset = (page - 1) * PAGE_SIZE;
  const resultParams = new URLSearchParams({
    f: "json",
    where,
    outFields: fields,
    returnGeometry: "false",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
  });
  const countParams = new URLSearchParams({ f: "json", where, returnCountOnly: "true" });
  const [result, count] = await Promise.all([
    fetchJson<ArcGisPayload>(url, resultParams),
    fetchJson<ArcGisPayload>(url, countParams),
  ]);
  if (result.error || count.error) {
    throw new Error(result.error?.message ?? count.error?.message ?? "Official property lookup failed.");
  }
  return {
    items: (result.features ?? []).map((feature) => normalize(feature.attributes ?? {})),
    total: Number(count.count ?? result.features?.length ?? 0),
  };
}

function parcelRecord(
  market: PropertyMarketDirectoryEntry,
  values: Partial<QualifiedSale> & Pick<QualifiedSale, "parcelId">,
): QualifiedSale {
  return {
    parcelId: values.parcelId,
    address: values.address ?? null,
    propertyType: values.propertyType ?? null,
    salePrice: values.salePrice ?? null,
    saleDate: values.saleDate ?? null,
    bedrooms: values.bedrooms ?? null,
    bathrooms: values.bathrooms ?? null,
    buildingSquareFeet: values.buildingSquareFeet ?? null,
    assessedValue: values.assessedValue ?? null,
    annualTax: values.annualTax ?? null,
    city: market.city,
    state: market.stateAbbr,
    neighborhood: values.neighborhood ?? null,
    tractGeoid: values.tractGeoid ?? null,
    postalCode: values.postalCode ?? null,
    sourceUrl: values.sourceUrl ?? officialPropertyDetailUrl(market, values.parcelId),
    sourceName: market.officialSourceName,
    yearBuilt: values.yearBuilt ?? null,
    latitude: values.latitude ?? null,
    longitude: values.longitude ?? null,
    saleQuality: values.saleDate || values.salePrice ? "RECORDED_SALE_PRICE_SCREENED" : "PUBLIC_PARCEL_RECORD",
    recordType: values.saleDate || values.salePrice ? "recorded-sale" : "parcel",
    dataVintage: values.dataVintage ?? market.dataVintage,
  };
}

async function lookupDetroit(market: PropertyMarketDirectoryEntry, query: string, page: number): Promise<LookupResult> {
  const q = safeQuery(query);
  const result = await arcGisLookup({
    url: "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/parcel_file_current/FeatureServer/0/query",
    where: `(UPPER(address) LIKE '%${q}%' OR UPPER(parcel_id) LIKE '%${q}%' OR UPPER(neighborhood) LIKE '%${q}%')`,
    fields: "parcel_id,address,zip_code,property_class_description,use_code_description,year_built,total_floor_area,amt_assessed_value,sale_date,amt_sale_price,neighborhood",
    page,
    normalize: (a) => parcelRecord(market, {
      parcelId: cleanText(a.parcel_id) ?? "Parcel ID unavailable",
      address: cleanText(a.address),
      postalCode: cleanText(a.zip_code),
      propertyType: cleanText(a.use_code_description) ?? cleanText(a.property_class_description),
      yearBuilt: cleanYear(a.year_built),
      buildingSquareFeet: cleanNumber(a.total_floor_area),
      assessedValue: cleanNumber(a.amt_assessed_value),
      saleDate: arcGisDate(a.sale_date),
      salePrice: cleanNumber(a.amt_sale_price),
      neighborhood: cleanText(a.neighborhood),
    }),
  });
  return { ...result, sourceUrl: market.officialSourceUrl, sourceName: market.officialSourceName };
}

async function lookupCharlotte(market: PropertyMarketDirectoryEntry, query: string, page: number): Promise<LookupResult> {
  const q = safeQuery(query);
  const result = await arcGisLookup({
    url: "https://gis.charlottenc.gov/arcgis/rest/services/CLT_Ex/CLTEx_MoreInfo/MapServer/4/query",
    where: `Municipality='CHARLOTTE' AND (UPPER(Location) LIKE '%${q}%' OR UPPER(PID) LIKE '%${q}%')`,
    fields: "PID,Property_Use,Property_URL,Municipality,Total_Value,Sales_Date,Price,Building_Type,Year_Built,Heated_Sqft,Location",
    page,
    normalize: (a) => parcelRecord(market, {
      parcelId: cleanText(a.PID) ?? "Parcel ID unavailable",
      address: cleanText(a.Location),
      propertyType: cleanText(a.Building_Type) ?? cleanText(a.Property_Use),
      assessedValue: cleanNumber(a.Total_Value),
      saleDate: arcGisDate(a.Sales_Date),
      salePrice: cleanNumber(a.Price),
      yearBuilt: cleanYear(a.Year_Built),
      buildingSquareFeet: cleanNumber(a.Heated_Sqft),
      sourceUrl: cleanText(a.Property_URL) ?? market.officialSourceUrl,
    }),
  });
  return { ...result, sourceUrl: market.officialSourceUrl, sourceName: market.officialSourceName };
}

async function lookupBoston(market: PropertyMarketDirectoryEntry, query: string, page: number): Promise<LookupResult> {
  const q = safeQuery(query);
  const result = await arcGisLookup({
    url: "https://gisportal.boston.gov/arcgis/rest/services/Assessing/PROPERTY_ASSESSMENT_PARCEL_JOIN_FY26/FeatureServer/0/query",
    where: `(UPPER(FULL_ADDRESS) LIKE '%${q}%' OR UPPER(PID) LIKE '%${q}%' OR UPPER(CITY) LIKE '%${q}%')`,
    fields: "PID,FULL_ADDRESS,CITY,ZIP_CODE,LU_DESC,BLDG_TYPE,LIVING_AREA,TOTAL_VALUE,GROSS_TAX,YR_BUILT,BED_RMS,FULL_BTH,HLF_BTH",
    page,
    normalize: (a) => parcelRecord(market, {
      parcelId: cleanText(a.PID) ?? "Parcel ID unavailable",
      address: cleanText(a.FULL_ADDRESS),
      postalCode: cleanText(a.ZIP_CODE),
      neighborhood: cleanText(a.CITY)?.toUpperCase() === "BOSTON" ? null : cleanText(a.CITY),
      propertyType: cleanText(a.LU_DESC) ?? cleanText(a.BLDG_TYPE),
      buildingSquareFeet: cleanNumber(a.LIVING_AREA),
      assessedValue: cleanNumber(a.TOTAL_VALUE),
      annualTax: cleanNumber(a.GROSS_TAX),
      yearBuilt: cleanYear(a.YR_BUILT),
      bedrooms: cleanNumber(a.BED_RMS),
      bathrooms: (() => {
        const full = Number(a.FULL_BTH ?? 0);
        const half = Number(a.HLF_BTH ?? 0);
        const total = full + half * 0.5;
        return total > 0 ? total : null;
      })(),
    }),
  });
  return { ...result, sourceUrl: market.officialSourceUrl, sourceName: market.officialSourceName };
}

async function lookupTampa(market: PropertyMarketDirectoryEntry, query: string, page: number): Promise<LookupResult> {
  const q = safeQuery(query);
  const result = await arcGisLookup({
    url: "https://arcgis.tampagov.net/arcgis/rest/services/Parcels/TaxParcel/MapServer/0/query",
    where: `UPPER(SITE_CITY)='TAMPA' AND (UPPER(SITE_ADDR) LIKE '%${q}%' OR UPPER(FOLIO) LIKE '%${q}%' OR UPPER(PIN) LIKE '%${q}%' OR UPPER(STRAP) LIKE '%${q}%')`,
    fields: "TYPE,FOLIO,PIN,DOR_C,SITE_ADDR,SITE_CITY,SITE_ZIP,STRAP,JUST,ASD_VAL,ACT,HEAT_AR,S_DATE,AMT,NBHC,STORIES",
    page,
    normalize: (a) => {
      const parcelId = cleanText(a.STRAP) ?? cleanText(a.FOLIO) ?? cleanText(a.PIN) ?? "Parcel ID unavailable";
      return parcelRecord(market, {
        parcelId,
        address: cleanText(a.SITE_ADDR),
        postalCode: cleanText(a.SITE_ZIP),
        propertyType: cleanText(a.TYPE) ?? (cleanText(a.DOR_C) ? `DOR use ${cleanText(a.DOR_C)}` : null),
        assessedValue: cleanNumber(a.JUST) ?? cleanNumber(a.ASD_VAL),
        yearBuilt: cleanYear(a.ACT),
        buildingSquareFeet: cleanNumber(a.HEAT_AR),
        saleDate: arcGisDate(a.S_DATE),
        salePrice: cleanNumber(a.AMT),
        neighborhood: cleanText(a.NBHC) ? `Appraiser area ${cleanText(a.NBHC)}` : null,
        sourceUrl: officialPropertyDetailUrl(market, parcelId),
      });
    },
  });
  return { ...result, sourceUrl: market.officialSourceUrl, sourceName: market.officialSourceName };
}

async function lookupCharleston(market: PropertyMarketDirectoryEntry, query: string, page: number): Promise<LookupResult> {
  const q = safeQuery(query);
  const result = await arcGisLookup({
    url: "https://gisccapps.charlestoncounty.org/arcgis/rest/services/CONNECT/CONNECT_MAP/MapServer/0/query",
    where: `(UPPER(ADDRLABEL) LIKE '%${q}%' OR UPPER(PARCELID) LIKE '%${q}%')`,
    fields: "PARCELID,ADDRLABEL,CMTYNAME,ZIPCODE,ADDRUSE,last_edite",
    page,
    normalize: (a) => parcelRecord(market, {
      parcelId: cleanText(a.PARCELID) ?? "Parcel ID unavailable",
      address: cleanText(a.ADDRLABEL),
      postalCode: cleanText(a.ZIPCODE),
      propertyType: cleanText(a.ADDRUSE),
      neighborhood: cleanText(a.CMTYNAME)?.toUpperCase() === "CHARLESTON" ? null : cleanText(a.CMTYNAME),
      dataVintage: arcGisDate(a.last_edite),
    }),
  });
  return { ...result, sourceUrl: market.officialSourceUrl, sourceName: market.officialSourceName };
}

type SocrataRow = Record<string, string | undefined>;

async function socrataRows(url: string, params: Record<string, string>) {
  return fetchJson<SocrataRow[]>(url, new URLSearchParams(params));
}

async function lookupChicago(market: PropertyMarketDirectoryEntry, query: string, page: number): Promise<LookupResult> {
  const q = safeQuery(query);
  const addressUrl = "https://datacatalog.cookcountyil.gov/resource/3723-97qp.json";
  const [yearRows] = await Promise.all([
    socrataRows(addressUrl, { "$select": "max(year) as year", "$limit": "1" }),
  ]);
  const latestYear = yearRows[0]?.year ?? "2025";
  const pinQuery = q.replace(/\D/g, "");
  const pinClause = pinQuery.length >= 3 ? ` OR pin like '%${pinQuery}%'` : "";
  const where = `year='${latestYear}' AND upper(prop_address_city_name)='CHICAGO' AND (upper(prop_address_full) like '%${q}%'${pinClause})`;
  const addressRows = await socrataRows(addressUrl, {
    "$select": "pin,year,prop_address_full,prop_address_city_name,prop_address_state,prop_address_zipcode_1",
    "$where": where,
    "$order": "prop_address_full",
    "$limit": String(PAGE_SIZE + 1),
    "$offset": String((page - 1) * PAGE_SIZE),
  });
  const hasMore = addressRows.length > PAGE_SIZE;
  const rows = addressRows.slice(0, PAGE_SIZE);
  const pins = rows.map((row) => row.pin).filter((pin): pin is string => Boolean(pin));
  let sales = new Map<string, SocrataRow>();
  let contexts = new Map<string, SocrataRow>();
  if (pins.length) {
    const pinList = pins.map((pin) => `'${pin.replaceAll("'", "''")}'`).join(",");
    const [saleRows, contextRows] = await Promise.all([
      socrataRows("https://datacatalog.cookcountyil.gov/resource/wvhk-k5uv.json", {
        "$select": "pin,sale_date,sale_price,class",
        "$where": `pin in(${pinList})`,
        "$order": "sale_date DESC",
        "$limit": "100",
      }),
      socrataRows("https://datacatalog.cookcountyil.gov/resource/pabr-t5kh.json", {
        "$select": "pin,class,census_tract_geoid,chicago_community_area_name,lat,lon",
        "$where": `pin in(${pinList})`,
        "$limit": "100",
      }),
    ]);
    sales = new Map(saleRows.reverse().map((row) => [row.pin ?? "", row]));
    contexts = new Map(contextRows.map((row) => [row.pin ?? "", row]));
  }
  const items = rows.map((row) => {
    const sale = sales.get(row.pin ?? "");
    const context = contexts.get(row.pin ?? "");
    return parcelRecord(market, {
      parcelId: row.pin ?? "Parcel ID unavailable",
      address: cleanText(row.prop_address_full),
      postalCode: cleanText(row.prop_address_zipcode_1),
      propertyType: cleanText(context?.class ?? sale?.class) ? `Assessor class ${cleanText(context?.class ?? sale?.class)}` : null,
      saleDate: isoDate(sale?.sale_date),
      salePrice: cleanNumber(sale?.sale_price),
      neighborhood: cleanText(context?.chicago_community_area_name),
      tractGeoid: cleanText(context?.census_tract_geoid),
      latitude: cleanNumber(context?.lat),
      longitude: cleanNumber(context?.lon),
      dataVintage: `Cook County tax year ${latestYear}`,
    });
  });
  return {
    items,
    total: (page - 1) * PAGE_SIZE + items.length + (hasMore ? 1 : 0),
    totalIsLowerBound: hasMore,
    sourceUrl: market.officialSourceUrl,
    sourceName: market.officialSourceName,
  };
}

export const PUBLIC_PROPERTY_PAGE_SIZE = PAGE_SIZE;

export async function lookupOfficialProperties(
  market: PropertyMarketDirectoryEntry,
  query: string,
  page: number,
): Promise<LookupResult> {
  if (query.trim().length < 3) {
    return { items: [], total: 0, sourceUrl: market.officialSourceUrl, sourceName: market.officialSourceName };
  }
  switch (market.city) {
    case "Detroit": return lookupDetroit(market, query, page);
    case "Charlotte": return lookupCharlotte(market, query, page);
    case "Charleston": return lookupCharleston(market, query, page);
    case "Boston": return lookupBoston(market, query, page);
    case "Tampa": return lookupTampa(market, query, page);
    case "Chicago": return lookupChicago(market, query, page);
    default: return { items: [], total: 0, sourceUrl: market.officialSourceUrl, sourceName: market.officialSourceName };
  }
}
