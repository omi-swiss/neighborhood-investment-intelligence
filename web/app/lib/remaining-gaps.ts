import payload from "../data/remaining-gaps.generated.json";

export type PublicInvestmentCandidate = {
  id: string;
  recipient: string | null;
  description: string | null;
  awardAmount: number | null;
  totalOutlays: number | null;
  projectType: string;
  awardingAgency: string | null;
  sourceUrl: string;
};

export type QualifiedSale = {
  parcelId: string;
  address: string | null;
  propertyType: string | null;
  salePrice: number | null;
  saleDate: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  buildingSquareFeet: number | null;
  assessedValue: number | null;
  annualTax: number | null;
  city: string;
  state: string;
  neighborhood: string | null;
  tractGeoid: string | null;
  postalCode: string | null;
  sourceUrl: string;
  sourceName: string;
  yearBuilt: number | null;
  latitude: number | null;
  longitude: number | null;
  saleQuality: "QUALIFIED_PUBLIC_RECORD" | "RECORDED_SALE_PRICE_SCREENED" | "PUBLIC_PARCEL_RECORD";
  recordType?: "recorded-sale" | "parcel";
  dataVintage?: string | null;
};

export type RolloutMarket = {
  id: string;
  name: string;
  cbsaCode: string;
  priorityTier: number;
  status: "LIVE" | "SCREENER_LIVE" | "NEXT" | "PLANNED";
  publicRecordStrategy: string;
  listingStrategy: string;
  transitStrategy: string;
  notes: string | null;
  tractBoundaryCount: number;
  dataReadiness: "FULL_PILOT" | "SCREENING_ACTIVE" | "BOUNDARIES_READY" | "GEOGRAPHY_PENDING";
};

export type RemainingGapsPayload = {
  generatedAt: string;
  coverage: {
    publicInvestmentCandidateCount: number;
    publicPropertyRecordCount: number;
    recentQualifiedSaleCount: number;
    propertyMarkets: Record<string, {
      recordCount: number;
      tractCount: number;
      latestSaleDate: string | null;
    }>;
  };
  publicInvestmentCandidates: PublicInvestmentCandidate[];
  recentQualifiedSales: QualifiedSale[];
  markets: RolloutMarket[];
  marketplaceContract: {
    publicRecords: string;
    activeListings: string;
    userImports: string;
  };
};

export const remainingGaps = payload as RemainingGapsPayload;
