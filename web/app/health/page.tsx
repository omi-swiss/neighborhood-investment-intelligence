import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import dataset from "../data/areas.generated.json";
import { evidenceLayers } from "../lib/evidence";

export const metadata: Metadata = { title: "Data health" };

export default function DataHealthPage() {
  const supported = [
    ["Area profiles", dataset.coverage.areaCount, "Healthy", "ACS 2023 and tract boundaries"],
    ["Historical trends", dataset.coverage.areaCount, "Healthy", `${dataset.coverage.trendStartYear}-${dataset.coverage.scoreReferenceYear}`],
    ["Map boundaries", dataset.coverage.areaCount, "Healthy", `${dataset.coverage.geographyVintage} geography vintage`],
  ];
  const pending = [
    ["Property marketplace", "Ready for import", "Authorized manual or CSV records only"],
    ["Sales and rental comparables", "Ready for import", "Explicit private transactions only; active listings are not substituted"],
    ["Financial models", "User supplied", "Versioned assumptions, sensitivity, and stress calculations"],
    ["In-app monitoring", "Ready", "Pull-based snapshot comparison; user initiates each refresh"],
    ["External alert delivery", "Not configured", "Email and SMS require an approved provider and credentials"],
    ["Tract crime", "Unavailable", "State-only FBI data is not substituted"],
    ...evidenceLayers.map((layer) => [
      layer.label,
      layer.status === "warehouse_ready" ? "Warehouse ready" : "Pipeline ready",
      `${layer.websiteCoverage}. ${layer.evidenceRule}`,
    ]),
  ];
  return (
    <PageShell
      active="Data health"
      eyebrow="Coverage observability"
      title="Data health"
      description="Current evidence availability, freshness, geography, and known gaps."
    >
      <div className="scope-strip">
        <strong>Dataset generated {new Date(dataset.generatedAt).toLocaleDateString("en-US")}</strong>
        <span>{dataset.coverage.areaCount} supported tracts</span>
        <span>{dataset.methodology.source}</span>
      </div>
      <div className="content-grid">
        <section className="detail-card wide-card">
          <h2>Integrated layers</h2>
          <div className="table-wrap">
            <table className="comparison-table">
              <thead><tr><th>Layer</th><th>Records</th><th>Status</th><th>Evidence</th></tr></thead>
              <tbody>
                {supported.map(([layer, records, status, evidence]) => (
                  <tr key={String(layer)}><td>{layer}</td><td>{records}</td><td><span className="quality">{status}</span></td><td>{evidence}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="detail-card wide-card">
          <h2>Pending, unavailable, or user-supplied layers</h2>
          {pending.map(([layer, status, note]) => (
            <div className="source-item" key={layer}>
              <strong>{layer}: {status}</strong><span>{note}</span>
            </div>
          ))}
        </section>
      </div>
    </PageShell>
  );
}
