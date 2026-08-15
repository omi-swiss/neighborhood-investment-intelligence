import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SaveAreaButton } from "../../components/SaveAreaButton";
import { WatchEntityButton } from "../../components/WatchEntityButton";
import { DataVintageNotice } from "../../components/DataVintageNotice";
import {
  dataset,
  formatCurrency,
  formatInteger,
  formatPercent,
  getArea,
  scoreDefinitions,
} from "../../lib/areas";
import { remainingGaps } from "../../lib/remaining-gaps";
import { areaDecisionInsight, buildMarketCenters, investorAreaName } from "../../lib/area-insights";

type Props = { params: Promise<{ id: string }> };
const marketCenters = buildMarketCenters(dataset.areas);

export function generateStaticParams() {
  return dataset.areas.map((area) => ({ id: area.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const area = getArea(id);
  const areaName = area ? investorAreaName(area, marketCenters[area.marketId]) : "Area not found";
  return area
    ? {
        title: areaName,
        description: `${areaName} investment evidence, historical trends, score components, and decision context.`,
      }
    : { title: "Area not found" };
}

export default async function AreaDetailPage({ params }: Props) {
  const { id } = await params;
  const area = getArea(id);
  if (!area) notFound();
  const areaName = investorAreaName(area, marketCenters[area.marketId]);
  const insight = areaDecisionInsight(area);
  const incomeTrend = area.trends.filter((point) => point.income !== null);
  const cityBenchmark = dataset.benchmarks.byCity[area.city] ?? dataset.benchmarks.city;
  const metroBenchmark = dataset.benchmarks.byMetro[area.metro] ?? dataset.benchmarks.metro;
  const exactSales = remainingGaps.recentQualifiedSales
    .filter((sale) => sale.tractGeoid === area.id)
    .slice(0, 8);
  const marketSales = remainingGaps.recentQualifiedSales
    .filter((sale) => sale.city === area.city)
    .slice(0, 8);
  const displayedSales = exactSales.length ? exactSales : marketSales;
  const salesAreExact = exactSales.length > 0;

  return (
    <div className="detail-shell">
      <header className="detail-top">
        <Link className="back-link" href="/">← Discover Markets</Link>
        <div className="actions">
          <SaveAreaButton areaId={area.id} />
          <WatchEntityButton entityType="area" entityKey={area.id} />
          <Link className="button" href={`/compare?ids=${area.id}`}>Compare area</Link>
        </div>
      </header>
      <main className="detail-main">
        <p className="eyebrow">Neighborhood investment brief</p>
        <h1 className="detail-title">{areaName}</h1>
        <p className="detail-context">
          {area.city}, {area.stateAbbr} · {area.county} · {area.metro} · Census tract {area.id}
        </p>
        {area.nameConfidence !== "high" ? <p className="label-confidence-note">Neighborhood label is approximate and based on tract position. The Census tract remains the auditable geography.</p> : null}

        <DataVintageNotice />

        <div className="detail-grid">
          <section className="detail-card wide-card area-decision-brief">
            <div className="section-heading">
              <div><p className="eyebrow">What the platform found</p><h2>Investor decision snapshot</h2></div>
              <Link className="button primary" href={`/properties?market=${encodeURIComponent(area.city)}`}>Analyze a property in {area.city}</Link>
            </div>
            <div className="decision-score-grid">
              <MetricTile label="Opportunity score" value={area.score?.toFixed(0) ?? "Not available"} note="Strategy-weighted area rank" />
              <MetricTile label="Market quality" value={insight.marketQualityScore?.toFixed(0) ?? "Not available"} note="Area fundamentals only" />
              <MetricTile label="Rental demand" value={insight.rentalDemandScore?.toFixed(0) ?? "Not available"} note="Rental strength and housing demand" />
              <MetricTile label="Risk" value={insight.riskLabel} note="Available economic resilience evidence" />
              <MetricTile label="Data confidence" value={insight.dataConfidence} note={`${formatPercent(area.metrics.metricCoverage)} metric completeness`} />
            </div>
            <div className="investment-thesis-grid">
              <div><span>Investment thesis</span><strong>{insight.thesis}</strong></div>
              <div><span>Primary risk</span><strong>{insight.primaryRisk}</strong></div>
              <div><span>What to do next</span><strong>Validate rents, taxes, insurance, physical condition, and financing on a specific property before judging deal quality.</strong></div>
            </div>
          </section>
          <section className="detail-card">
            <h2>Current area evidence</h2>
            <div className="metric-grid">
              <MetricTile label="Population" value={formatInteger(area.metrics.population)} note="ACS 2023 • observed" />
              <MetricTile label="Household income" value={formatCurrency(area.metrics.medianHouseholdIncome)} note={`${formatPercent(area.metrics.incomeGrowth, true)} real CAGR`} />
              <MetricTile label="Median home value" value={formatCurrency(area.metrics.medianHomeValue)} note="Area median • not an appraisal" />
              <MetricTile label="Median gross rent" value={formatCurrency(area.metrics.medianGrossRent)} note="Monthly area median" />
              <MetricTile label="Gross-yield proxy" value={formatPercent(area.metrics.grossYieldProxy)} note="Median rent × 12 / median value" />
              <MetricTile label="Rental vacancy" value={formatPercent(area.metrics.vacancyRate)} note="Lower is favorable in this strategy" />
            </div>
          </section>
          <section className="detail-card">
            <h2>Balanced opportunity</h2>
            <div className="score-hero">
              <span className="score">{area.score?.toFixed(0) ?? "—"}</span>
              <div>
                <strong>Supported-market percentile</strong>
                <span>{formatPercent(area.metrics.metricCoverage)} metric coverage</span>
              </div>
            </div>
            {scoreDefinitions.map((definition) => (
              <div className="score-row" key={definition.key}>
                <span>{definition.label}</span>
                <strong>{area.scores[definition.key]?.toFixed(0) ?? "—"}</strong>
                <div className="score-bar">
                  <span style={{ width: `${area.scores[definition.key] ?? 0}%` }} />
                </div>
              </div>
            ))}
          </section>
          <section className="detail-card">
            <h2>Inflation-adjusted household income trend</h2>
            <TrendChart points={incomeTrend.map((point) => ({ year: point.year, value: point.income! }))} />
            <div className="method-note">
              ACS five-year windows overlap, so adjacent releases are not independent annual samples.
              Values are shown as published evidence, not a causal forecast.
            </div>
          </section>
          <section className="detail-card">
            <h2>City and metro comparison</h2>
            <div className="table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr><th>Metric</th><th>This tract</th><th>City median</th><th>Metro median</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Household income</td>
                    <td>{formatCurrency(area.metrics.medianHouseholdIncome)}</td>
                    <td>{formatCurrency(cityBenchmark.medianHouseholdIncome)}</td>
                    <td>{formatCurrency(metroBenchmark.medianHouseholdIncome)}</td>
                  </tr>
                  <tr>
                    <td>Home value</td>
                    <td>{formatCurrency(area.metrics.medianHomeValue)}</td>
                    <td>{formatCurrency(cityBenchmark.medianHomeValue)}</td>
                    <td>{formatCurrency(metroBenchmark.medianHomeValue)}</td>
                  </tr>
                  <tr>
                    <td>Gross rent</td>
                    <td>{formatCurrency(area.metrics.medianGrossRent)}</td>
                    <td>{formatCurrency(cityBenchmark.medianGrossRent)}</td>
                    <td>{formatCurrency(metroBenchmark.medianGrossRent)}</td>
                  </tr>
                  <tr>
                    <td>Rental vacancy</td>
                    <td>{formatPercent(area.metrics.vacancyRate)}</td>
                    <td>{formatPercent(cityBenchmark.vacancyRate)}</td>
                    <td>{formatPercent(metroBenchmark.vacancyRate)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="method-note">
              City cohort: {cityBenchmark.areaCount} tracts. Metro cohort:{" "}
              {metroBenchmark.areaCount} tracts. Medians retain tract-level source resolution.
            </div>
          </section>
          <section className="detail-card wide-card">
            <div className="section-heading">
              <div>
                <h2>Recent recorded property sales</h2>
                <p className="drawer-lead">
                  {salesAreExact
                    ? `Public records linked to census tract ${area.id}.`
                    : `No tract identifier is published with the available ${area.city} records, so the latest city records are shown as context.`}
                </p>
              </div>
              <Link className="button" href={`/properties?market=${encodeURIComponent(area.city)}`}>
                Browse {area.city}
              </Link>
            </div>
            {displayedSales.length ? (
              <div className="table-wrap">
                <table className="comparison-table property-sales-table">
                  <thead>
                    <tr>
                      <th>Property and neighborhood</th>
                      <th>Sale date</th>
                      <th>Recorded price</th>
                      <th>Building facts</th>
                      <th>Official record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSales.map((sale) => (
                      <tr key={`${sale.city}-${sale.parcelId}-${sale.saleDate}`}>
                        <td>
                          <strong>{sale.address ?? "Address unavailable"}</strong>
                          <br />
                          <small>
                            {sale.neighborhood ?? `${sale.city}, ${sale.state}`}
                            {sale.tractGeoid ? ` • Tract ${sale.tractGeoid.slice(-6)}` : ""}
                          </small>
                        </td>
                        <td>{sale.saleDate ?? "Unavailable"}</td>
                        <td>{formatCurrency(sale.salePrice)}</td>
                        <td>
                          {sale.bedrooms ?? "—"} bd · {sale.bathrooms ?? "—"} ba ·{" "}
                          {sale.buildingSquareFeet?.toLocaleString() ?? "—"} sq ft
                        </td>
                        <td>
                          <a
                            className="source-link"
                            href={sale.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View property record ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="drawer-lead">
                No recent public sale records are available for this market yet.
              </p>
            )}
            <div className="method-note">
              Recorded sales are public-record evidence, not active listings. Baltimore and
              Philadelphia records use a $10,000 minimum-price screen; D.C. records also carry
              the jurisdiction&apos;s qualified-sale flag. Verify deed, condition, arms-length
              status, and availability before underwriting.
            </div>
          </section>
          <section className="detail-card">
            <h2>Decision notes</h2>
            <p className="drawer-lead">
              This profile is for research and decision support. It is not financial, legal, tax,
              appraisal, lending, or investment advice. Independently verify conditions, laws,
              financing, taxes, insurance, and property facts.
            </p>
            <Link className="button" href="/">Return to filtered results</Link>
          </section>
        </div>
      </main>
    </div>
  );
}

function MetricTile({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function TrendChart({ points }: { points: Array<{ year: number; value: number }> }) {
  if (points.length < 2) return <p className="drawer-lead">Not enough comparable history is available.</p>;
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const tickSize = Math.max(5_000, Math.ceil((maximum - minimum) / 4 / 5_000) * 5_000);
  const lowerBound = Math.floor(minimum / tickSize) * tickSize;
  const upperBound = Math.max(
    lowerBound + tickSize * 4,
    Math.ceil(maximum / tickSize) * tickSize,
  );
  const spread = upperBound - lowerBound;
  const ticks = Array.from({ length: 5 }, (_, index) =>
    lowerBound + ((upperBound - lowerBound) * index) / 4
  );
  const chartPoints = points.map((point, index) => {
    const x = 82 + (index / (points.length - 1)) * 488;
    const y = 178 - ((point.value - lowerBound) / spread) * 140;
    return { ...point, x, y };
  });
  return (
    <svg className="trend-chart" viewBox="0 0 600 220" role="img" aria-label="Household income trend">
      {ticks.map((tick) => {
        const y = 178 - ((tick - lowerBound) / spread) * 140;
        return (
          <g key={tick}>
            <line className="chart-grid" x1="82" x2="570" y1={y} y2={y} />
            <text className="chart-axis-label" x="72" y={y + 4} textAnchor="end">
              ${Math.round(tick / 1000)}k
            </text>
          </g>
        );
      })}
      <line className="chart-axis" x1="82" x2="82" y1="38" y2="178" />
      <polyline className="chart-line" points={chartPoints.map((point) => `${point.x},${point.y}`).join(" ")} />
      {chartPoints.map((point) => (
        <g key={point.year}>
          <circle className="chart-dot" cx={point.x} cy={point.y} r="5" />
          <text x={point.x} y="207" textAnchor="middle" fontSize="10" fill="#64716a">{point.year}</text>
          <title>{point.year}: {formatCurrency(point.value)}</title>
        </g>
      ))}
    </svg>
  );
}
