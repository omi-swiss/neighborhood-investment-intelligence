import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/PageShell";
import {
  formatCurrency,
  formatInteger,
  formatPercent,
  getArea,
  scoreDefinitions,
} from "../lib/areas";
import type { AreaRecord } from "../lib/types";

export const metadata: Metadata = { title: "Area comparison" };

type Props = { searchParams: Promise<{ ids?: string | string[] }> };

export default async function ComparePage({ searchParams }: Props) {
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw.join(",") : raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 4);
  const areas = (await Promise.all(ids.map((id) => getArea(id)))).filter((area): area is AreaRecord => Boolean(area));
  return (
    <PageShell
      active="Compare"
      eyebrow="Side-by-side evidence"
      title="Compare Opportunities"
      description="Compare neighborhoods side by side without hiding missing values or data quality."
    >
      {!areas.length ? (
        <section className="detail-card empty-state">
          <h2>No tracts selected</h2>
          <p className="drawer-lead">Select neighborhoods in Discover Markets, then open this workspace.</p>
          <Link className="button primary" href="/">Choose tracts</Link>
        </section>
      ) : (
        <section className="detail-card wide-card">
          <div className="table-wrap">
            <table className="comparison-table compare-matrix">
              <thead>
                <tr>
                  <th>Evidence</th>
                  {areas.map((area) => <th key={area.id}><a href={`/areas/${area.id}`}>{area.name}</a><small>{area.county}</small></th>)}
                </tr>
              </thead>
              <tbody>
                <MetricRow label="Balanced score" areas={areas} render={(area) => area.score?.toFixed(0) ?? "Not available"} />
                <MetricRow label="Population" areas={areas} render={(area) => formatInteger(area.metrics.population)} />
                <MetricRow label="Population growth" areas={areas} render={(area) => formatPercent(area.metrics.populationGrowth, true)} />
                <MetricRow label="Household income" areas={areas} render={(area) => formatCurrency(area.metrics.medianHouseholdIncome)} />
                <MetricRow label="Real income growth" areas={areas} render={(area) => formatPercent(area.metrics.incomeGrowth, true)} />
                <MetricRow label="Median home value" areas={areas} render={(area) => formatCurrency(area.metrics.medianHomeValue)} />
                <MetricRow label="Median gross rent" areas={areas} render={(area) => formatCurrency(area.metrics.medianGrossRent)} />
                <MetricRow label="Gross-yield proxy" areas={areas} render={(area) => formatPercent(area.metrics.grossYieldProxy)} />
                <MetricRow label="Rental vacancy" areas={areas} render={(area) => formatPercent(area.metrics.vacancyRate)} />
                <MetricRow label="Metric coverage" areas={areas} render={(area) => formatPercent(area.metrics.metricCoverage)} />
                {scoreDefinitions.map((definition) => (
                  <MetricRow
                    key={definition.key}
                    label={definition.label}
                    areas={areas}
                    render={(area) => area.scores[definition.key]?.toFixed(0) ?? "Not available"}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="method-note">
            Scores shown here use the balanced system strategy. Return to the screener for a custom weighted ranking.
          </div>
        </section>
      )}
    </PageShell>
  );
}

function MetricRow({
  label,
  areas,
  render,
}: {
  label: string;
  areas: AreaRecord[];
  render: (area: AreaRecord) => string;
}) {
  return <tr><td>{label}</td>{areas.map((area) => <td key={area.id}>{render(area)}</td>)}</tr>;
}
