"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatInteger, formatPercent } from "../lib/area-shared";
import type { MarketContext } from "../data/market-context";

export type MarketProfile = {
  marketId: string;
  label: string;
  city: string;
  stateAbbr: string;
  areaCount: number;
  population: number;
  populationGrowth: number | null;
  households: number;
  medianAge: number | null;
  medianHouseholdIncome: number | null;
  medianHomeValue: number | null;
  medianRent: number | null;
  vacancyRate: number | null;
  renterShare: number | null;
  unemploymentRate: number | null;
  povertyRate: number | null;
  dataCoverage: number | null;
};

export type SignalEvent = {
  id: string;
  marketId: string;
  category: string;
  title: string;
  organization: string;
  stage: string;
  date: string | null;
  sourceUrl: string;
  evidenceStatus: "verified-source" | "candidate";
  investmentAmount?: number;
  expectedJobs?: number;
  talentSignal?: string;
  signalType?: "Private development" | "Employer investment" | "Federal award" | "State / local grant" | "Infrastructure / transit" | "Planning / zoning" | "Urbanism / public realm" | "Permit";
  fundingLevel?: "Private" | "Federal" | "State" | "Local" | "Mixed" | "Not applicable";
  geographyScope?: string;
  amountType?: "Investment" | "Award" | "Program allocation" | "Program total";
  sourceClass?: "Official award" | "Official planning" | "Official permit" | "Company primary" | "Official program" | "Research context";
  lastVerifiedDate?: string;
};

export function SignalsWorkspace({
  generatedAt,
  profiles,
  events,
  contexts,
}: {
  generatedAt: string;
  profiles: MarketProfile[];
  events: SignalEvent[];
  contexts: MarketContext[];
}) {
  const [marketId, setMarketId] = useState(profiles[0]?.marketId ?? "");
  const [category, setCategory] = useState("all");
  const [stage, setStage] = useState("all");
  const [signalType, setSignalType] = useState("all");
  const [fundingLevel, setFundingLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [eventPage, setEventPage] = useState(1);
  const profile = profiles.find((item) => item.marketId === marketId) ?? profiles[0];
  const context = contexts.find((item) => item.marketId === marketId);
  const filteredEvents = useMemo(() => events.filter((event) =>
    event.marketId === marketId &&
    (category === "all" || event.category === category) &&
    (stage === "all" || event.stage === stage) &&
    (signalType === "all" || event.signalType === signalType) &&
    (fundingLevel === "all" || event.fundingLevel === fundingLevel) &&
    (!search || `${event.title} ${event.organization}`.toLowerCase().includes(search.toLowerCase()))
  ), [category, events, fundingLevel, marketId, search, signalType, stage]);
  const categories = [...new Set(events.filter((event) => event.marketId === marketId).map((event) => event.category))];
  const stages = [...new Set(events.filter((event) => event.marketId === marketId).map((event) => event.stage))];
  const signalTypes = [...new Set(events.filter((event) => event.marketId === marketId).map((event) => event.signalType).filter((value): value is NonNullable<SignalEvent["signalType"]> => Boolean(value)))];
  const fundingLevels = [...new Set(events.filter((event) => event.marketId === marketId).map((event) => event.fundingLevel).filter((value): value is NonNullable<SignalEvent["fundingLevel"]> => Boolean(value)))];
  const eventPageCount = Math.max(1, Math.ceil(filteredEvents.length / 10));
  const pagedEvents = filteredEvents.slice((eventPage - 1) * 10, eventPage * 10);
  const marketEvents = events.filter((event) => event.marketId === marketId);
  const verifiedCount = marketEvents.filter((event) => event.evidenceStatus === "verified-source").length;
  const publicCount = marketEvents.filter((event) => ["Federal", "State", "Local"].includes(event.fundingLevel ?? "")).length;
  const privateCount = marketEvents.filter((event) => event.fundingLevel === "Private").length;
  const disclosedCapital = marketEvents.reduce((sum, event) =>
    sum + (event.investmentAmount && event.amountType !== "Program total" ? event.investmentAmount : 0), 0);

  useEffect(() => setEventPage(1), [category, fundingLevel, marketId, search, signalType, stage]);

  function toggleSaved(key: string) {
    setSaved((items) => items.includes(key) ? items.filter((item) => item !== key) : [...items, key]);
  }

  if (!profile) return <div className="method-note">No supported market profiles are available.</div>;

  return (
    <div className="signals-workspace">
      <div className="signals-toolbar">
        <label className="field" htmlFor="signals-market">
          <span>Market</span>
          <select id="signals-market" value={marketId} onChange={(event) => setMarketId(event.target.value)}>
            {profiles.map((item) => <option key={item.marketId} value={item.marketId}>{item.label}</option>)}
          </select>
        </label>
        <button className="button" onClick={() => toggleSaved(`market:${marketId}`)}>
          {saved.includes(`market:${marketId}`) ? "Saved city" : "Save city"}
        </button>
        <span className="quality">Core profile build {new Date(generatedAt).toLocaleDateString()}</span>
      </div>

      <section className="detail-card wide-card">
        <div className="signals-heading">
          <div><p className="eyebrow">City profile</p><h2>{profile.city}, {profile.stateAbbr}</h2></div>
          <span className="quality">{profile.areaCount} comparable tracts</span>
        </div>
        <div className="metric-grid">
          <ProfileMetric label="Population" value={formatInteger(profile.population)} note={formatPercent(profile.populationGrowth, true) + " annual growth"} />
          <ProfileMetric label="Households" value={formatInteger(profile.households)} note="ACS five-year estimate" />
          <ProfileMetric label="Median age" value={profile.medianAge?.toFixed(1) ?? "Not available"} note="Median across comparable tracts" />
          <ProfileMetric label="Household income" value={formatCurrency(profile.medianHouseholdIncome)} note="Inflation-adjusted tract median" />
          <ProfileMetric label="Home value" value={formatCurrency(profile.medianHomeValue)} note="Owner-occupied housing proxy" />
          <ProfileMetric label="Median rent" value={formatCurrency(profile.medianRent)} note={`${formatPercent(profile.vacancyRate)} median vacancy`} />
          <ProfileMetric label="Renter share" value={formatPercent(profile.renterShare)} note="Tenure mix" />
          <ProfileMetric label="Economic risk" value={formatPercent(profile.unemploymentRate)} note={`${formatPercent(profile.povertyRate)} poverty`} />
          <ProfileMetric
            label="Net migration"
            value={context ? formatSignedInteger(context.migration.netPeople) : "Not available"}
            note={context
              ? `IRS ${context.migration.dataYear} · ${formatInteger(context.migration.inboundPeople)} in · ${formatInteger(context.migration.outboundPeople)} out`
              : "IRS migration data unavailable"}
          />
        </div>
        {context ? (
          <div className="city-context-grid">
            <article className="context-card">
              <span>Median annual property tax</span>
              <strong>{formatCurrency(context.medianAnnualPropertyTax)}</strong>
              <small>ACS {context.propertyTaxYear} five-year estimate for owner-occupied homes; not a parcel tax quote.</small>
            </article>
            <article className="context-card">
              <span>Political & governance context</span>
              <strong>Neutral policy context</strong>
              <small>2024 certified election context. {context.politicalContext}</small>
            </article>
            <article className="context-card">
              <span>Landlord operating environment</span>
              <strong>Relative rank {context.landlordFriendlinessRank}</strong>
              <small>{context.landlordEnvironment}. Relative screening rank based on statewide landlord-tenant procedure and city operating requirements.</small>
            </article>
            <article className="context-card migration-context">
              <span>Income carried by movers</span>
              <strong className={context.migration.netAgi >= 0 ? "signal-positive" : "signal-negative"}>
                {formatSignedCurrency(context.migration.netAgi)} net AGI
              </strong>
              <small>
                {formatCompactCurrency(context.migration.inboundAgi)} moved in and {formatCompactCurrency(context.migration.outboundAgi)} moved out during {context.migration.dataYear}. {context.migration.geographyLabel} is a {context.migration.geographyType}.
              </small>
            </article>
          </div>
        ) : null}
        <p className="method-note">
          Migration uses IRS address changes on tax returns: returns approximate households, exemptions
          approximate people, and AGI measures income carried by movers. County proxies are clearly labeled
          and should not be read as exact city-boundary counts. The current IRS release covers moves
          from 2022 to 2023 and was published March 19, 2026. Growth uses overlapping ACS 2019–2023 windows.
        </p>
      </section>

      <section className="detail-card wide-card">
        <div className="signals-heading">
          <div><p className="eyebrow">Investment & development</p><h2>Verified project, grant, and urbanism pipeline</h2></div>
          <span className="quality">{filteredEvents.length} records</span>
        </div>
        <div className="signal-summary-grid">
          <ProfileMetric label="Market records" value={formatInteger(marketEvents.length)} note={`${verifiedCount} verified records`} />
          <ProfileMetric label="Public funding" value={formatInteger(publicCount)} note="Federal, state, and local signals" />
          <ProfileMetric label="Private / employer" value={formatInteger(privateCount)} note="Company and development signals" />
          <ProfileMetric label="Disclosed capital" value={formatCompactCurrency(disclosedCapital)} note="Excludes portfolio totals to limit double counting" />
        </div>
        <div className="signals-filters">
          <input aria-label="Search signals" onChange={(event) => setSearch(event.target.value)} placeholder="Search project or organization" value={search} />
          <select aria-label="Filter signal category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Filter signal stage" value={stage} onChange={(event) => setStage(event.target.value)}>
            <option value="all">All stages</option>
            {stages.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Filter signal type" value={signalType} onChange={(event) => setSignalType(event.target.value)}>
            <option value="all">All signal types</option>
            {signalTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select aria-label="Filter funding level" value={fundingLevel} onChange={(event) => setFundingLevel(event.target.value)}>
            <option value="all">All funding levels</option>
            {fundingLevels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {filteredEvents.length ? (
          <div className="table-wrap">
            <table className="comparison-table signal-table">
              <thead><tr><th>Signal</th><th>Organization</th><th>Stage</th><th>Date</th><th /></tr></thead>
              <tbody>{pagedEvents.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{event.title}</strong><br />
                    <small>{event.category}</small>
                    <div className="signal-taxonomy">
                      {event.signalType ? <span>{event.signalType}</span> : null}
                      {event.fundingLevel ? <span>{event.fundingLevel}</span> : null}
                      {event.geographyScope ? <span>{event.geographyScope}</span> : null}
                    </div>
                    {(event.investmentAmount || event.expectedJobs) ? (
                      <div className="signal-impact">
                        {event.investmentAmount ? <span>{formatCompactCurrency(event.investmentAmount)} capital</span> : null}
                        {event.expectedJobs ? <span>{formatInteger(event.expectedJobs)} jobs</span> : null}
                      </div>
                    ) : null}
                    {event.talentSignal ? <p className="talent-signal">{event.talentSignal}</p> : null}
                  </td>
                  <td>{event.organization}</td>
                  <td><span className="quality">{event.stage}</span></td>
                  <td>{event.date ?? "Not available"}</td>
                  <td><button className="text-button" onClick={() => toggleSaved(event.id)}>{saved.includes(event.id) ? "Saved" : "Save"}</button></td>
                </tr>
              ))}</tbody>
            </table>
            <div className="pagination signal-pagination">
              <span>Page {eventPage} of {eventPageCount} · 10 items per page</span>
              <div className="pagination-controls">
                <button aria-label="Previous signal page" disabled={eventPage <= 1} onClick={() => setEventPage((page) => Math.max(1, page - 1))}>‹</button>
                <button aria-label="Next signal page" disabled={eventPage >= eventPageCount} onClick={() => setEventPage((page) => Math.min(eventPageCount, page + 1))}>›</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <strong>No verified events for this market yet</strong>
            <p>No local investment events currently match this market and filter combination.</p>
          </div>
        )}
        <p className="method-note">
          Announcements remain labeled “Announced” until an official source confirms a later stage.
          Building databases may identify leads, but only government, company, filing, permit, or planning
          evidence is promoted into this table. Grant opportunities are not counted as awards.
        </p>
      </section>

      <section className="detail-card wide-card">
        <div className="signals-heading"><div><p className="eyebrow">Regulatory profile</p><h2>Decision context</h2></div></div>
        {context?.regulatoryProfile.length ? (
          <div className="table-wrap">
            <table className="comparison-table">
              <thead><tr><th>Dimension</th><th>Summary</th><th>Reviewed</th></tr></thead>
              <tbody>{context.regulatoryProfile.map((policy) => (
                <tr key={policy.id}>
                  <td><strong>{policy.dimension}</strong></td>
                  <td>{policy.summary}<br /><small>{policy.applicabilityNote}</small></td>
                  <td>{policy.lastVerifiedDate}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <strong>Regulatory profile not yet verified</strong>
            <p>Local policy coverage is incomplete for {profile.city}. Use local counsel and official jurisdiction sources.</p>
          </div>
        )}
        <p className="method-note">Screening context only. Applicability is property- and transaction-specific; this is not legal or tax advice.</p>
      </section>
    </div>
  );
}

function ProfileMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "−"}${formatCompactCurrency(Math.abs(value))}`;
}

function formatSignedInteger(value: number) {
  return `${value >= 0 ? "+" : "−"}${formatInteger(Math.abs(value))} people`;
}
