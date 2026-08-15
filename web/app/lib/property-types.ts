export const PROPERTY_TYPES = [
  "single-family",
  "condominium",
  "cooperative",
  "two-to-four-unit",
  "small-multifamily",
  "multifamily",
  "mixed-use",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
