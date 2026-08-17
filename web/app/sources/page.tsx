import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import dataset from "../data/areas.generated.json";
import { marketContexts, marketMigrationContexts } from "../data/market-context";
import { propertyMarketDirectory } from "../data/property-markets";
import { marketOpenDataSources, signalSources } from "../data/signal-sources";

export const metadata: Metadata = {
  title: "Sources",
  description: "Central registry for the data, public records, policy references, and discovery feeds used by Neighborhood Investment Intelligence.",
};

const marketNames = new Map(propertyMarketDirectory.map((market) => [market.id, `${market.city}, ${market.stateAbbr}`]));

export default function SourcesPage() {
  return (
    <PageShell
      active="Sources"
      eyebrow="Systems"
      title="Sources"
      description="The central registry for data vintages, official property systems, market signals, public records, and policy references."
    >
      <nav className="source-index" aria-label="Source registry sections">
        <a href="#data-vintage-register">Data years</a>
        <a href="#property-sources">Property records</a>
        <a href="#signal-sources">Signals</a>
        <a href="#city-open-data">City open data</a>
        <a href="#city-context">City context</a>
        <a href="#outreach-rules">Outreach rules</a>
      </nav>

      <div className="content-grid source-registry">
        <section className="detail-card wide-card" id="data-vintage-register">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Freshness register</p>
              <h2>Data years and primary systems</h2>
            </div>
          </div>
          <p className="drawer-lead">
            “Latest” is evaluated separately for every dataset because surveys, migration files,
            elections, permits, sales, and policy reviews publish on different schedules.
          </p>
          <div className="table-wrap">
            <table className="comparison-table">
              <thead>
                <tr><th>Product layer</th><th>Observation period</th><th>Status</th><th>Primary source</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Core tract profiles and scores</strong></td>
                  <td>ACS 2019–2023 five-year</td>
                  <td>Production reference year 2023</td>
                  <td><a className="source-link" href={dataset.methodology.sourceUrl} target="_blank" rel="noreferrer">U.S. Census Bureau ACS</a></td>
                </tr>
                <tr>
                  <td><strong>Trend comparisons</strong></td>
                  <td>ACS 2019 and 2023 releases</td>
                  <td>Overlapping five-year windows</td>
                  <td><a className="source-link" href={dataset.methodology.sourceUrl} target="_blank" rel="noreferrer">U.S. Census Bureau ACS</a></td>
                </tr>
                <tr>
                  <td><strong>Property-tax profile</strong></td>
                  <td>ACS 2020–2024 five-year</td>
                  <td>Current profile release</td>
                  <td><a className="source-link" href="https://api.census.gov/data/2024/acs/acs5/groups/B25103.html" target="_blank" rel="noreferrer">ACS table B25103</a></td>
                </tr>
                <tr>
                  <td><strong>Net migration and mover AGI</strong></td>
                  <td>IRS 2022–2023</td>
                  <td>Published March 19, 2026</td>
                  <td><a className="source-link" href="https://www.irs.gov/statistics/soi-tax-stats-migration-data-2022-2023" target="_blank" rel="noreferrer">IRS Statistics of Income</a></td>
                </tr>
                <tr>
                  <td><strong>Political context</strong></td>
                  <td>2024 certified results</td>
                  <td>Reviewed by market</td>
                  <td>Official state and local election authorities</td>
                </tr>
                <tr>
                  <td><strong>Development and investment</strong></td>
                  <td>Record-specific dates</td>
                  <td>Announcement, award, permit, or project stage retained</td>
                  <td>Government, company, filing, permit, and planning records</td>
                </tr>
                <tr>
                  <td><strong>Regulatory profiles</strong></td>
                  <td>Reviewed July 30, 2026</td>
                  <td>Property-specific verification still required</td>
                  <td>Official codes and agency guidance</td>
                </tr>
                <tr>
                  <td><strong>Property sales</strong></td>
                  <td>Record-specific sale dates</td>
                  <td>Availability varies by jurisdiction</td>
                  <td>Assessor, recorder, and property-account systems</td>
                </tr>
                <tr>
                  <td><strong>Tract boundaries</strong></td>
                  <td>{dataset.coverage.geographyVintage} Census geography</td>
                  <td>Boundary vintage is independent of survey year</td>
                  <td><a className="source-link" href="https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.2020.html" target="_blank" rel="noreferrer">Census TIGER/Line</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="detail-card wide-card" id="property-sources">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Property systems</p>
              <h2>Official parcel and assessment records</h2>
            </div>
          </div>
          <div className="property-source-grid">
            {propertyMarketDirectory.map((market) => (
              <article className="property-source-card" key={market.id}>
                <div className="property-source-card-head">
                  <div className="market-monogram" aria-hidden="true">{market.city.slice(0, 2).toUpperCase()}</div>
                  <div><h3>{market.city}, {market.stateAbbr}</h3><p>{market.countyLabel}</p></div>
                  <span className="source-status live">
                    {market.recordCoverage === "live-official" ? "Live search" : "Verified snapshot"}
                  </span>
                </div>
                <p>{market.sourceNote}</p>
                <small>{market.dataVintage}</small>
                <a className="button" href={market.officialSourceUrl} target="_blank" rel="noreferrer">
                  Open {market.officialSourceName}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="detail-card wide-card" id="signal-sources">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Investment and development</p>
              <h2>Signal providers and evidence roles</h2>
            </div>
          </div>
          <div className="source-coverage-grid">
            {signalSources.map((source) => (
              <article className="source-coverage-card" key={source.id}>
                <div className="source-coverage-heading">
                  <strong>{source.name}</strong>
                  <span className={`source-role source-role-${source.role.toLowerCase()}`}>{source.role}</span>
                </div>
                <p>{source.coverage}</p>
                <div className="source-coverage-status">
                  <span>{source.status}</span>
                  <span>{source.access}</span>
                </div>
                <small>{source.note}</small>
                <a className="source-link" href={source.sourceUrl} target="_blank" rel="noreferrer">Open source</a>
              </article>
            ))}
          </div>
          <p className="method-note">
            Discovery publications identify leads. They are not treated as proof that a project is
            funded, permitted, under construction, or complete until primary evidence confirms it.
          </p>
        </section>

        <section className="detail-card wide-card" id="city-open-data">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Local government</p>
              <h2>City open-data portals</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="comparison-table">
              <thead><tr><th>Market</th><th>Portal</th><th>Useful datasets</th></tr></thead>
              <tbody>
                {Object.entries(marketOpenDataSources).map(([marketId, source]) => (
                  <tr key={marketId}>
                    <td><strong>{marketNames.get(marketId) ?? marketId}</strong></td>
                    <td><a className="source-link" href={source.url} target="_blank" rel="noreferrer">{source.name}</a></td>
                    <td>{source.coverage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="detail-card wide-card" id="city-context">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Policy and demographics</p>
              <h2>City-context references</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="comparison-table">
              <thead><tr><th>Market</th><th>Property tax</th><th>Migration</th><th>Election context</th><th>Landlord law</th></tr></thead>
              <tbody>
                {marketMigrationContexts.map((migrationContext) => {
                  const context = marketContexts.find((item) => item.marketId === migrationContext.marketId);
                  return <tr key={migrationContext.marketId}>
                    <td><strong>{marketNames.get(migrationContext.marketId) ?? migrationContext.marketId}</strong></td>
                    <td>{context ? <a className="source-link" href={context.propertyTaxSourceUrl} target="_blank" rel="noreferrer">ACS {context.propertyTaxYear}</a> : "Not yet verified"}</td>
                    <td><a className="source-link" href={migrationContext.migration.sourceUrl} target="_blank" rel="noreferrer">IRS {migrationContext.migration.dataYear}</a></td>
                    <td>{context ? <a className="source-link" href={context.politicalSourceUrl} target="_blank" rel="noreferrer">Official results</a> : "Not yet verified"}</td>
                    <td>{context ? <a className="source-link" href={context.landlordSourceUrl} target="_blank" rel="noreferrer">Official law</a> : "Not yet verified"}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          <div className="regulatory-source-list">
            {marketContexts.flatMap((context) =>
              context.regulatoryProfile.map((policy) => (
                <article className="source-item" key={`${context.marketId}:${policy.id}`}>
                  <strong>{marketNames.get(context.marketId)} · {policy.dimension}</strong>
                  <span>
                    {policy.summary} Reviewed {policy.lastVerifiedDate}.{" "}
                    <a className="source-link" href={policy.sourceUrl} target="_blank" rel="noreferrer">
                      {policy.citation || "Official guidance"}
                    </a>
                  </span>
                </article>
              )),
            )}
          </div>
        </section>

        <section className="detail-card wide-card" id="outreach-rules">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Off-market outreach</p>
              <h2>Compliance references</h2>
            </div>
          </div>
          <div className="source-list">
            <div className="source-item">
              <strong>Telephone outreach</strong>
              <span><a className="source-link" href="https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule" target="_blank" rel="noreferrer">FTC Telemarketing Sales Rule guidance</a></span>
            </div>
            <div className="source-item">
              <strong>Commercial email</strong>
              <span><a className="source-link" href="https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business" target="_blank" rel="noreferrer">FTC CAN-SPAM compliance guide</a></span>
            </div>
          </div>
          <p className="method-note">
            Parcel ownership is not permission to contact. Verify ownership, obtain contact data
            lawfully, apply federal and state suppression rules, and retain opt-out records.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
