import payload from "../data/phase8.generated.json";

export type DevelopmentPin = {
  id: string;
  address: string;
  ownerOrApplicant: string | null;
  permitType: string | null;
  issueDate: string | null;
  latitude: number;
  longitude: number;
  signalTier: string;
  sourceUrl: string;
  interpretation: string;
};

export type EnvironmentalPin = {
  id: string;
  name: string;
  category: string;
  programCodes: string | null;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  interpretation: string;
};

export type RegulatoryPolicy = {
  id: string;
  dimension: string;
  summary: string;
  citation: string | null;
  sourceUrl: string;
  lastVerifiedDate: string;
  applicabilityNote: string;
};

export type Phase8Payload = {
  generatedAt: string;
  coverage: {
    label: string;
    developmentPermitCount: number;
    environmentalSiteCount: number;
    floodTractCount: number;
    regulatoryPolicyCount: number;
  };
  developmentPins: DevelopmentPin[];
  environmentalPins: EnvironmentalPin[];
  floodByTract: Record<string, number>;
  policies: RegulatoryPolicy[];
  evidenceRules: Record<"development" | "environment" | "flood" | "regulation", string>;
};

export const phase8 = payload as Phase8Payload;
