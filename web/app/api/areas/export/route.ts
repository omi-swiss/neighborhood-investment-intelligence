import { filterAreas } from "../../../lib/areas";
import { filtersFromSearch } from "../../../lib/screener-query";

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const filters = filtersFromSearch(search);
  const rows = filterAreas(filters);
  const header = [
    "tract_geoid",
    "market_id",
    "area_name",
    "tract_label",
    "neighborhood_name",
    "name_source",
    "name_confidence",
    "county",
    "state",
    "city",
    "metro",
    "strategy_name",
    "strategy_version",
    "opportunity_score",
    "population",
    "population_growth_cagr",
    "median_household_income",
    "income_growth_real_cagr",
    "median_gross_rent",
    "median_home_value",
    "gross_yield_proxy",
    "rental_vacancy",
    "renter_share",
    "metric_coverage",
    "source",
    "source_available_at",
    "geography_vintage",
  ];
  const body = rows.map((area) =>
    [
      area.id,
      area.marketId,
      area.name,
      area.tractLabel,
      area.neighborhood,
      area.nameSource,
      area.nameConfidence,
      area.county,
      area.state,
      area.city,
      area.metro,
      filters.strategyName,
      filters.strategyVersion,
      area.score,
      area.metrics.population,
      area.metrics.populationGrowth,
      area.metrics.medianHouseholdIncome,
      area.metrics.incomeGrowth,
      area.metrics.medianGrossRent,
      area.metrics.medianHomeValue,
      area.metrics.grossYieldProxy,
      area.metrics.vacancyRate,
      area.metrics.renterShare,
      area.metrics.metricCoverage,
      "U.S. Census Bureau ACS 5-year",
      "2024-12-12",
      "2020",
    ].map(csvCell).join(","),
  );
  return new Response([header.join(","), ...body].join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nii-opportunity-screen.csv"',
      "Cache-Control": "private, max-age=30",
    },
  });
}
