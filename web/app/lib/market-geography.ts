export type MarketCounty = {
  countyGeoid: string;
  countyLabel: string;
  countyType: "county" | "county_equivalent";
};

export const marketCountyById: Record<string, MarketCounty> = {
  "place:1150000": { countyGeoid: "11001", countyLabel: "District of Columbia", countyType: "county_equivalent" },
  "place:2404000": { countyGeoid: "24510", countyLabel: "Baltimore city", countyType: "county_equivalent" },
  "place:4260000": { countyGeoid: "42101", countyLabel: "Philadelphia County", countyType: "county_equivalent" },
  "place:2622000": { countyGeoid: "26163", countyLabel: "Wayne County", countyType: "county" },
  "place:3712000": { countyGeoid: "37119", countyLabel: "Mecklenburg County", countyType: "county" },
  "place:4513330": { countyGeoid: "45019", countyLabel: "Charleston County", countyType: "county" },
  "place:2507000": { countyGeoid: "25025", countyLabel: "Suffolk County", countyType: "county" },
  "place:1271000": { countyGeoid: "12057", countyLabel: "Hillsborough County", countyType: "county" },
  "place:1714000": { countyGeoid: "17031", countyLabel: "Cook County", countyType: "county" },
};

export function marketCounty(marketId: string): MarketCounty | undefined {
  return marketCountyById[marketId];
}
