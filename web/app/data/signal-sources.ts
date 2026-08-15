import type { SignalEvent } from "../components/SignalsWorkspace";

export type SignalSource = {
  id: string;
  name: string;
  coverage: string;
  role: "Evidence" | "Context" | "Discovery";
  status: "Live" | "Next ingestion" | "Discovery only";
  access: "No key" | "Free key required" | "No structured API";
  sourceUrl: string;
  note: string;
};

export const signalSources: SignalSource[] = [
  {
    id: "usaspending",
    name: "USAspending",
    coverage: "Federal awards and recipient spending",
    role: "Evidence",
    status: "Next ingestion",
    access: "No key",
    sourceUrl: "https://api.usaspending.gov/",
    note: "Award-level federal spending; place of performance must be retained separately from recipient headquarters.",
  },
  {
    id: "hud-cpd",
    name: "HUD CPD allocations",
    coverage: "CDBG, HOME, ESG, HOPWA, and housing trust allocations",
    role: "Evidence",
    status: "Live",
    access: "No key",
    sourceUrl: "https://www.hud.gov/hud-partners/community-budget-25",
    note: "Annual formula allocations are promoted as funded programs, not completed projects.",
  },
  {
    id: "hud-open-data",
    name: "HUD Open Data",
    coverage: "Assisted housing, affordability, and community-development geography",
    role: "Evidence",
    status: "Next ingestion",
    access: "No key",
    sourceUrl: "https://www.huduser.gov/portal/pdrdatas_landing.html",
    note: "Bulk and geospatial sources can enrich housing supply and subsidy context.",
  },
  {
    id: "city-portals",
    name: "City open-data portals",
    coverage: "Permits, rezonings, capital projects, land use, and public works",
    role: "Evidence",
    status: "Next ingestion",
    access: "No key",
    sourceUrl: "https://catalog.data.gov/dataset/",
    note: "Each market connector will use the city's direct API; Data.gov is used only to discover the underlying official dataset.",
  },
  {
    id: "sec-edgar",
    name: "SEC EDGAR + company investor relations",
    coverage: "Employer expansion, facilities, capital commitments, and risk disclosures",
    role: "Evidence",
    status: "Next ingestion",
    access: "No key",
    sourceUrl: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
    note: "Filings and company releases can confirm announcements; announcements remain announced until later evidence changes the stage.",
  },
  {
    id: "economic-development",
    name: "State and local economic-development agencies",
    coverage: "Private capital, job commitments, incentives, and facility announcements",
    role: "Evidence",
    status: "Live",
    access: "No key",
    sourceUrl: "https://www.usa.gov/state-local-governments",
    note: "Official releases currently support employer and private-investment records across the covered markets.",
  },
  {
    id: "urban-institute",
    name: "Urban Institute",
    coverage: "Infrastructure equity, zoning, housing, and transit-oriented development",
    role: "Context",
    status: "Next ingestion",
    access: "No key",
    sourceUrl: "https://www.urban.org/data-catalog",
    note: "Research datasets become market context and benchmarks, not project-completion evidence.",
  },
  {
    id: "planetizen",
    name: "Planetizen",
    coverage: "Planning, zoning, transportation, and urbanism news",
    role: "Discovery",
    status: "Discovery only",
    access: "No structured API",
    sourceUrl: "https://www.planetizen.com/news",
    note: "Useful for finding leads; each lead must be confirmed by a government, filing, permit, or company primary source.",
  },
  {
    id: "bloomberg-citylab",
    name: "Bloomberg CityLab",
    coverage: "Urban policy, development, housing, and infrastructure reporting",
    role: "Discovery",
    status: "Discovery only",
    access: "No structured API",
    sourceUrl: "https://www.bloomberg.com/citylab",
    note: "Editorial reporting is a discovery and interpretation layer, not the evidence of record.",
  },
  {
    id: "grants-gov",
    name: "Grants.gov",
    coverage: "Open federal funding opportunities",
    role: "Discovery",
    status: "Next ingestion",
    access: "Free key required",
    sourceUrl: "https://simpler.grants.gov/developers",
    note: "Opportunities indicate possible future funding; awarded money is verified through USAspending or the awarding agency.",
  },
];

const hudCpdMarkets = [
  { marketId: "place:1150000", city: "Washington, DC" },
  { marketId: "place:2404000", city: "Baltimore" },
  { marketId: "place:4260000", city: "Philadelphia" },
  { marketId: "place:2622000", city: "Detroit" },
  { marketId: "place:3712000", city: "Charlotte" },
  { marketId: "place:4513330", city: "Charleston" },
  { marketId: "place:2507000", city: "Boston" },
  { marketId: "place:1271000", city: "Tampa" },
  { marketId: "place:1714000", city: "Chicago" },
] as const;

export const federalCommunityDevelopmentEvents: SignalEvent[] = hudCpdMarkets.map(({ marketId, city }) => ({
  id: `hud-cpd-fy2025:${marketId}`,
  marketId,
  category: "Federal community-development grants",
  title: `FY2025 HUD community-development formula allocations published for ${city}`,
  organization: "U.S. Department of Housing and Urban Development",
  stage: "Funded",
  date: "2025-05-13",
  sourceUrl: "https://www.hud.gov/hud-partners/community-budget-25",
  evidenceStatus: "verified-source",
  signalType: "Federal award",
  fundingLevel: "Federal",
  geographyScope: "City / entitlement jurisdiction",
  amountType: "Program allocation",
  sourceClass: "Official award",
  lastVerifiedDate: "2026-07-30",
  talentSignal: "CDBG, HOME, ESG, HOPWA, and related formula funding can support housing, neighborhood stabilization, and community facilities; the mix varies by jurisdiction.",
}));

export const marketOpenDataSources: Record<string, { name: string; url: string; coverage: string }> = {
  "place:1150000": { name: "Open Data DC", url: "https://opendata.dc.gov/", coverage: "Permits, planning, property, contracts, and capital projects" },
  "place:2404000": { name: "Baltimore City Open Data", url: "https://data.baltimorecity.gov/", coverage: "Permits, development, property, transportation, and capital planning" },
  "place:4260000": { name: "OpenDataPhilly", url: "https://opendataphilly.org/", coverage: "Permits, zoning, property, streets, and public investment" },
  "place:2622000": { name: "Detroit Open Data", url: "https://data.detroitmi.gov/", coverage: "Permits, parcels, demolitions, planning, and neighborhood programs" },
  "place:3712000": { name: "Charlotte Open Data", url: "https://data.charlottenc.gov/", coverage: "Building permits, land development, rezonings, and infrastructure" },
  "place:4513330": { name: "Charleston Open Data", url: "https://www.charleston-sc.gov/1570/Open-Data", coverage: "GIS, planning, permits, public works, and economic development" },
  "place:2507000": { name: "Analyze Boston", url: "https://data.boston.gov/", coverage: "Development review, permits, property, transportation, and capital budgets" },
  "place:1271000": { name: "Tampa Open Data", url: "https://www.tampa.gov/technology-and-innovation/data-and-maps", coverage: "Permits, planning, projects, mobility, and public works" },
  "place:1714000": { name: "Chicago Data Portal", url: "https://data.cityofchicago.org/", coverage: "Permits, zoning, contracts, TIF, transportation, and development" },
};
