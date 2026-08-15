import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import dataset from "../data/areas.generated.json";
import { builtInStrategies, scoreDefinitions } from "../lib/areas";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return (
    <PageShell
      active="Methodology"
      eyebrow="Evidence and scoring"
      title="Methodology"
      description="How the product measures, ranks, labels, and limits its evidence."
      actions={<a className="button" href="/sources">View source registry</a>}
    >
      <div className="content-grid">
        <section className="detail-card">
          <h2>Score components</h2>
          {scoreDefinitions.map((definition) => (
            <div className="source-item" key={definition.key}>
              <strong>{definition.label}</strong>
              <span>{definition.evidence}. {definition.direction}.</span>
            </div>
          ))}
        </section>
        <section className="detail-card">
          <h2>Strategies and normalization</h2>
          <p className="drawer-lead">
            Each component is a 0-100 percentile within the currently supported city cohort.
            A strategy is a versioned set of nonnegative weights. Changing
            a preset immediately changes the composite opportunity score and rank, but never rewrites
            observed income, value, growth, yield, or vacancy. When a component is unavailable, its
            weight is excluded and the remaining weights are renormalized; coverage remains visible.
          </p>
          {builtInStrategies.map((strategy) => (
            <div className="source-item" key={strategy.key}>
              <strong>{strategy.name} v{strategy.version}</strong>
              <span>
                {strategy.description}{" "}
                {scoreDefinitions.map((definition) =>
                  `${definition.label}: ${Math.round(strategy.weights[definition.key] * 100)}%`,
                ).join(" | ")}
              </span>
            </div>
          ))}
        </section>
        <section className="detail-card">
          <h2>Derived values and limitations</h2>
          <p className="drawer-lead">
            Gross-yield proxy equals median monthly gross rent times 12 divided by median home value.
            Growth figures compare ACS five-year releases; overlapping windows are not independent.
            These are area-level estimates, not property appraisals or forecasts.
          </p>
          <ul className="method-list">
            {dataset.methodology.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
            <li>DC-only flood, regulation, permit, and property layers are not inferred for Baltimore or Philadelphia.</li>
            <li>Scores support research; they are not financial, legal, tax, or investment advice.</li>
          </ul>
        </section>
        <section className="detail-card wide-card">
          <h2>Financial underwriting</h2>
          <p className="drawer-lead">
            Financial models are pre-tax, versioned calculations. Property observations are loaded
            only when present; every remaining system default is labeled and editable. NOI equals
            effective gross income less operating expenses. Capital reserves are shown below NOI.
            Debt service is amortized monthly, and exit value uses either compounded appreciation
            or forward NOI divided by an exit cap rate.
          </p>
          <ul className="method-list">
            <li>Cap rate = year-one NOI / offer price.</li>
            <li>Cash-on-cash return = year-one pre-tax cash flow / initial cash invested.</li>
            <li>DSCR = year-one NOI / annual debt service.</li>
            <li>IRR and NPV use the initial equity contribution, annual cash flows, and net sale proceeds.</li>
            <li>Taxes, depreciation, refinancing, and detailed multi-unit rent rolls are not modeled in this release.</li>
          </ul>
          <a className="button" href="/underwriting">Open financial underwriting</a>
        </section>
        <section className="detail-card wide-card">
          <h2>Comparable-property evidence</h2>
          <p className="drawer-lead">
            Sales and rental comparables are imported as distinct, authorized transaction records.
            Automatic matching considers geography, property type, units, size, age, and recency.
            Manual inclusions, exclusions, percentage adjustments, and notes are private and saved
            by subject property.
          </p>
          <ul className="method-list">
            <li>Closed sale prices are never inferred from active asking prices.</li>
            <li>Comparable values scale by square footage when available, then unit count.</li>
            <li>The estimate is the median adjusted comparable value.</li>
            <li>The displayed range is the interquartile range, not an appraisal confidence interval.</li>
            <li>Confidence reflects included-record count and average match strength, not a probability.</li>
          </ul>
        </section>
        <section className="detail-card wide-card">
          <h2>Monitoring and change detection</h2>
          <p className="drawer-lead">
            Watchlists preserve the last observed source-backed snapshot. A user-initiated refresh
            compares that snapshot with the current area publication or private property import,
            records eligible changes once, and then advances the snapshot.
          </p>
          <ul className="method-list">
            <li>Property alerts cover asking-price reductions, listing-status changes, and refreshed observations.</li>
            <li>Area alerts use a one-point score threshold and a 0.5-percentage-point vacancy threshold; rent changes and new data vintages are also eligible.</li>
            <li>Saved property searches detect newly imported records that satisfy the stored filters.</li>
            <li>Every alert retains previous and current values, detection time, source, and a decision-use note.</li>
            <li>Regulation monitoring remains unavailable until a validated primary policy source is integrated.</li>
            <li>Monitoring is pull-based and in-app; no background schedule, email, or SMS delivery is claimed.</li>
          </ul>
        </section>
        <section className="detail-card wide-card">
          <h2>Investment, regulation, and physical-risk evidence</h2>
          <p className="drawer-lead">
            Evidence pipelines preserve project funding stage, evidence type, effective dates,
            source-native geography, assignment method, confidence, and review status. Their website
            layers remain unavailable until verified records are populated.
          </p>
          <ul className="method-list">
            <li>Public proposed, budgeted, appropriated, awarded, and spent dollars are separate.</li>
            <li>Private news announcements are discovery records, not verified commitments.</li>
            <li>Policy dimensions remain separate and are not reduced to a landlord-friendliness score.</li>
            <li>Environmental and insurance factors remain individual metrics rather than a hidden composite.</li>
            <li>County or jurisdiction evidence is not silently assigned to a census tract.</li>
          </ul>
          <a className="button" href="/signals">Open signals and services</a>
        </section>
      </div>
    </PageShell>
  );
}
