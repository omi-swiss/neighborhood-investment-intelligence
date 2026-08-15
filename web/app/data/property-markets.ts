export type PropertyMarketDirectoryEntry = {
  id: string;
  city: string;
  stateAbbr: string;
  countyLabel: string;
  officialSourceName: string;
  officialSourceUrl: string;
  recordCoverage: "snapshot" | "live-official";
  sourceNote: string;
  dataVintage: string;
  searchHint: string;
};

export const propertyMarketDirectory: PropertyMarketDirectoryEntry[] = [
  {
    id: "place:1150000",
    city: "Washington",
    stateAbbr: "DC",
    countyLabel: "District of Columbia",
    officialSourceName: "DC Office of Tax and Revenue",
    officialSourceUrl: "https://mytax.dc.gov/_/",
    recordCoverage: "snapshot",
    sourceNote: "Integrated public sale records plus the official real-property account search.",
    dataVintage: "Current recorded-sale snapshot",
    searchHint: "Address, parcel, neighborhood, or tract",
  },
  {
    id: "place:2404000",
    city: "Baltimore",
    stateAbbr: "MD",
    countyLabel: "Baltimore city",
    officialSourceName: "Maryland SDAT Real Property",
    officialSourceUrl: "https://sdat.dat.maryland.gov/RealProperty/Pages/default.aspx",
    recordCoverage: "snapshot",
    sourceNote: "Integrated Baltimore City sales with direct links to official property detail.",
    dataVintage: "Current recorded-sale snapshot",
    searchHint: "Address, parcel, neighborhood, or tract",
  },
  {
    id: "place:4260000",
    city: "Philadelphia",
    stateAbbr: "PA",
    countyLabel: "Philadelphia County",
    officialSourceName: "Philadelphia Atlas",
    officialSourceUrl: "https://atlas.phila.gov/",
    recordCoverage: "snapshot",
    sourceNote: "Integrated OPA property and recorded-sale evidence with official parcel lookup.",
    dataVintage: "Current recorded-sale snapshot",
    searchHint: "Address, parcel, neighborhood, or tract",
  },
  {
    id: "place:2622000",
    city: "Detroit",
    stateAbbr: "MI",
    countyLabel: "Wayne County",
    officialSourceName: "Detroit Property Portal",
    officialSourceUrl: "https://detroitmi.gov/property-page",
    recordCoverage: "live-official",
    sourceNote: "Live parcel, assessment, use, neighborhood, and recorded-sale lookup from Detroit's current parcel service.",
    dataVintage: "Current city parcel service",
    searchHint: "Try Woodward, a parcel ID, or a neighborhood",
  },
  {
    id: "place:3712000",
    city: "Charlotte",
    stateAbbr: "NC",
    countyLabel: "Mecklenburg County",
    officialSourceName: "Mecklenburg County Assessor",
    officialSourceUrl: "https://cao.mecknc.gov/",
    recordCoverage: "live-official",
    sourceNote: "Live parcel, assessment, deed, building, and sale lookup from Charlotte-Mecklenburg GIS.",
    dataVintage: "Current county parcel service",
    searchHint: "Try Tryon, a street address, or parcel ID",
  },
  {
    id: "place:4513330",
    city: "Charleston",
    stateAbbr: "SC",
    countyLabel: "Charleston County",
    officialSourceName: "Charleston County Assessor",
    officialSourceUrl: "https://www.charlestoncounty.org/assessorsearch.php",
    recordCoverage: "live-official",
    sourceNote: "Live parcel-address lookup from Charleston County GIS with direct official-record verification.",
    dataVintage: "Current county address service",
    searchHint: "Try King, a street address, or parcel ID",
  },
  {
    id: "place:2507000",
    city: "Boston",
    stateAbbr: "MA",
    countyLabel: "Suffolk County",
    officialSourceName: "Boston Property Lookup",
    officialSourceUrl: "https://www.boston.gov/departments/assessing/property-data-and-information",
    recordCoverage: "live-official",
    sourceNote: "Live FY2026 parcel assessment lookup with value, tax, use, size, beds, baths, and year built.",
    dataVintage: "Boston FY2026 assessment",
    searchHint: "Try Washington, a street address, or parcel ID",
  },
  {
    id: "place:1271000",
    city: "Tampa",
    stateAbbr: "FL",
    countyLabel: "Hillsborough County",
    officialSourceName: "Hillsborough County Property Appraiser",
    officialSourceUrl: "https://www.hcpafl.org/",
    recordCoverage: "live-official",
    sourceNote: "Live daily Tampa parcel lookup with value, building facts, and recorded-sale context.",
    dataVintage: "Daily city parcel service",
    searchHint: "Try Bay, a Tampa address, folio, or PIN",
  },
  {
    id: "place:1714000",
    city: "Chicago",
    stateAbbr: "IL",
    countyLabel: "Cook County",
    officialSourceName: "Cook County Assessor",
    officialSourceUrl: "https://www.cookcountyassessoril.gov/address-search",
    recordCoverage: "live-official",
    sourceNote: "Live Cook County parcel-universe, address, geography, and recorded-sale lookup restricted to Chicago.",
    dataVintage: "Current Cook County open data",
    searchHint: "Try Michigan, a Chicago address, or 14-digit PIN",
  },
];
