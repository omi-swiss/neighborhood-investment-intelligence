export const coreMetadata = {
  generatedAt: "2026-08-17T15:00:22.554133+00:00",
  coverage: {
    label: "Twenty-city opportunity-screening cohort",
    city: "Twenty supported city-proper markets",
    metro: "Metro definitions shown separately and marked planned",
    geographicLevel: "census tract",
    scoreReferenceYear: 2024,
    trendStartYear: 2020,
    geographyVintage: "2020",
    areaCount: 6679,
  },
  methodology: {
    source: "U.S. Census Bureau ACS 5-year",
    sourceUrl: "https://www.census.gov/programs-surveys/acs",
    limitations: [
      "Scores rank comparable tracts across the twenty supported city-proper markets.",
      "Growth uses overlapping ACS 2020 and 2024 five-year windows on 2020 Census tract geography.",
      "Gross yield is a screening proxy based on area median rent and value, not property NOI.",
      "Official neighborhood labels are partial. A tract label is shown when no verified neighborhood source is available.",
      "Permits, flood, regulation, property, and signal coverage varies by market and stays explicitly unavailable where absent.",
    ],
  },
} as const;
