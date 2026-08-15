import { phase8 } from "./phase8";

export type EvidenceStatus = "integrated" | "warehouse_ready" | "pipeline_ready";

export type EvidenceLayer = {
  id: string;
  phase: 6 | 7;
  label: string;
  status: EvidenceStatus;
  nativeGeography: string;
  websiteCoverage: string;
  evidenceRule: string;
  publishedRecordCount: number;
  extract: string;
};

export const evidenceContractVersion = "phase8-evidence-1.1";

export const evidenceLayers: EvidenceLayer[] = [
  {
    id: "bridge_condition",
    phase: 6,
    label: "Bridge condition",
    status: "warehouse_ready",
    nativeGeography: "County",
    websiteCoverage: "Not yet joined to the Washington pilot",
    evidenceRule: "Official FHWA inspection condition; never down-assigned to tracts",
    publishedRecordCount: 0,
    extract: "FHWA NBI warehouse table",
  },
  {
    id: "public_investment",
    phase: 6,
    label: "Public capital and transit projects",
    status: "pipeline_ready",
    nativeGeography: "Project point or source-native jurisdiction",
    websiteCoverage: "No verified project-cost records published; permit activity is separate",
    evidenceRule: "Proposed, budgeted, appropriated, awarded, and spent funding stay separate",
    publishedRecordCount: 0,
    extract: "public_investment_map_pins.csv",
  },
  {
    id: "private_investment",
    phase: 6,
    label: "Private investment projects",
    status: "integrated",
    nativeGeography: "Project point and county",
    websiteCoverage: `${phase8.coverage.developmentPermitCount.toLocaleString()} development-permit candidates in analyst review`,
    evidenceRule: "News is discovery evidence; verified records require non-news primary evidence",
    publishedRecordCount: phase8.coverage.developmentPermitCount,
    extract: "development_permit_map_pins.csv and private_investment_review_queue.csv",
  },
  {
    id: "regulatory_policy",
    phase: 7,
    label: "Regulation and property-tax policy",
    status: "integrated",
    nativeGeography: "State, county, or city",
    websiteCoverage: `${phase8.coverage.regulatoryPolicyCount} verified District-wide policy dimensions`,
    evidenceRule: "Time-versioned official citations with manual review; not legal advice",
    publishedRecordCount: phase8.coverage.regulatoryPolicyCount,
    extract: "jurisdiction_regulatory_profile.csv",
  },
  {
    id: "environmental_risk",
    phase: 7,
    label: "Environmental and insurance risk",
    status: "integrated",
    nativeGeography: "Source-native geography",
    websiteCoverage: `${phase8.coverage.floodTractCount} flood-overlap tracts and ${phase8.coverage.environmentalSiteCount.toLocaleString()} EPA facility points`,
    evidenceRule: "Individual risk factors remain visible; no hidden composite score",
    publishedRecordCount:
      phase8.coverage.floodTractCount + phase8.coverage.environmentalSiteCount,
    extract: "geography_risk_profile.csv and environmental_risk_site_map_pins.csv",
  },
];

export const productServices = [
  {
    id: "strategy_profiles",
    label: "Strategy profiles",
    status: "active",
    note: "Built-in and private versioned weights with visible coverage.",
  },
  {
    id: "relative_value",
    label: "Relative-value analysis",
    status: "active",
    note: "Cohort-relative area ranking and property underwriting remain separate.",
  },
  {
    id: "comparison",
    label: "Neighborhood comparison",
    status: "active",
    note: "Supported tracts can be compared without filling unavailable evidence.",
  },
  {
    id: "maps",
    label: "Map service",
    status: "active",
    note: "Tract opportunity, development-permit, FEMA flood, and EPA facility context layers are active.",
  },
  {
    id: "evidence_api",
    label: "Evidence catalog API",
    status: "active",
    note: "Machine-readable layer status is available at /api/evidence.",
  },
  {
    id: "alerts",
    label: "Alerts",
    status: "partial",
    note: "Private pull-based monitoring is active; five verified DC policy dimensions can now seed change monitoring.",
  },
  {
    id: "exports",
    label: "Published extracts",
    status: "pipeline ready",
    note: "Source-controlled CSV contracts are generated for later website and BI loading.",
  },
] as const;
