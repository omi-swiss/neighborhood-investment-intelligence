"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  builtInStrategies,
  defaultFilters,
  formatCurrency,
  formatPercent,
  scoreDefinitions,
} from "../lib/area-shared";
import { filtersToSearch } from "../lib/screener-query";
import {
  areaDecisionInsight,
  buildMarketCenters,
  investorAreaName,
  type MarketCenter,
} from "../lib/area-insights";
import type {
  AreaRecord,
  Coverage,
  MarketMapSummary,
  MarketDefinition,
  ScreenerFilters,
  SortKey,
  StrategyDefinition,
} from "../lib/types";
import { AppNavigation } from "./AppNavigation";
import { DataVintageNotice } from "./DataVintageNotice";
import { OpportunityMap } from "./OpportunityMap";
import { appendContext } from "../lib/investor-context";

type AreaResponse = {
  items: AreaRecord[];
  mapItems: AreaRecord[];
  marketSummaries: MarketMapSummary[];
  mapTotal: number;
  mapTruncated: boolean;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type InvestorSearch = {
  strategy: string;
  minimumPrice: number;
  maximumPrice: number;
  minimumCashOnCash: number;
  minimumCapRate: number;
  minimumDscr: number;
  maximumRenovation: number;
  downPayment: number;
  interestRate: number;
  riskTolerance: "conservative" | "moderate" | "opportunistic";
  neighborhoodPreferences: string;
};

type FilterSuggestion = {
  label: string;
  count: number;
  filters: ScreenerFilters;
};

const investorStrategies = [
  { key: "cash-flow", label: "Cash flow", scoreStrategy: "rental-cash-flow" },
  { key: "appreciation", label: "Appreciation", scoreStrategy: "emerging-neighborhood" },
  { key: "balanced", label: "Balanced", scoreStrategy: "balanced" },
  { key: "value-add", label: "Value-add", scoreStrategy: "emerging-neighborhood" },
  { key: "house-hacking", label: "House hacking", scoreStrategy: "balanced" },
  { key: "small-multifamily", label: "Small multifamily", scoreStrategy: "rental-cash-flow" },
  { key: "long-term-rental", label: "Long-term rental", scoreStrategy: "low-risk-rental" },
] as const;

const defaultInvestorSearch: InvestorSearch = {
  strategy: "balanced",
  minimumPrice: 100_000,
  maximumPrice: 750_000,
  minimumCashOnCash: 0.08,
  minimumCapRate: 0.06,
  minimumDscr: 1.25,
  maximumRenovation: 75_000,
  downPayment: 0.25,
  interestRate: 0.07,
  riskTolerance: "moderate",
  neighborhoodPreferences: "",
};

function apiUrl(filters: ScreenerFilters, page: number): string {
  return `/api/areas?${filtersToSearch(filters, page, 20)}`;
}

export function OpportunityScreener({
  coverage,
  markets,
  initialFilters = defaultFilters,
}: {
  coverage: Coverage;
  markets: MarketDefinition[];
  initialFilters?: ScreenerFilters;
}) {
  const [draft, setDraft] = useState<ScreenerFilters>(initialFilters);
  const [filters, setFilters] = useState<ScreenerFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [response, setResponse] = useState<AreaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AreaRecord | null>(null);
  const [explaining, setExplaining] = useState<AreaRecord | null>(null);
  const [view, setView] = useState<"split" | "map" | "table">("split");
  const [saveMessage, setSaveMessage] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [strategies, setStrategies] = useState<StrategyDefinition[]>(builtInStrategies);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [investorSearch, setInvestorSearch] = useState<InvestorSearch>(defaultInvestorSearch);
  const [searchApplied, setSearchApplied] = useState(false);
  const [filterSuggestionResult, setFilterSuggestionResult] = useState<{
    key: string;
    items: FilterSuggestion[];
  }>({ key: "", items: [] });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = window.localStorage.getItem("nii-investor-search");
      if (!saved) return;
      try {
        setInvestorSearch({ ...defaultInvestorSearch, ...JSON.parse(saved) as Partial<InvestorSearch> });
      } catch {
        window.localStorage.removeItem("nii-investor-search");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/strategies")
      .then((result) =>
        result.ok ? result.json() as Promise<{ items: StrategyDefinition[] }> : null,
      )
      .then((payload) => {
        if (!cancelled && payload?.items.length) setStrategies(payload.items);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl(filters, page), { signal: controller.signal })
      .then((result) => {
        if (!result.ok) throw new Error("The screener service could not load this query.");
        return result.json() as Promise<AreaResponse>;
      })
      .then((payload) => {
        setResponse(payload);
        setError("");
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Unexpected screener error.");
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [filters, page, retryToken]);

  const activeFilterCount = useMemo(
    () =>
      [
        filters.search !== defaultFilters.search,
        filters.city !== defaultFilters.city,
        filters.minimumScore !== defaultFilters.minimumScore,
        filters.minimumIncomeGrowth !== defaultFilters.minimumIncomeGrowth,
        filters.minimumGrossYield !== defaultFilters.minimumGrossYield,
        filters.maximumVacancy !== defaultFilters.maximumVacancy,
        filters.strategyKey !== defaultFilters.strategyKey,
      ].filter(Boolean).length,
    [filters],
  );
  const selectedStrategy = strategies.find((item) => item.key === draft.strategyKey);
  const leadingWeights = useMemo(
    () =>
      scoreDefinitions
        .map((definition) => ({
          label: definition.label,
          weight: draft.strategyWeights[definition.key],
        }))
        .sort((left, right) => right.weight - left.weight)
        .slice(0, 3),
    [draft.strategyWeights],
  );
  const marketCenters = useMemo(
    () => buildMarketCenters(response?.mapItems ?? []),
    [response?.mapItems],
  );
  const selectedMarket = markets.find((market) => market.id === draft.city);
  const propertySearchParams = new URLSearchParams({
    ...(selectedMarket ? { market: selectedMarket.city } : {}),
    maximumPrice: String(investorSearch.maximumPrice),
  });
  const propertyHref = appendContext(`/properties?${propertySearchParams}`, {
    version: 1,
    marketId: selectedMarket?.id,
    tractGeoid: selected?.tractGeoid ?? selected?.id,
    strategyVersion: filters.strategyVersion,
    returnTo: "/",
  });
  const suggestionKey = JSON.stringify(filters);
  const filterSuggestions =
    !loading &&
    response?.total === 0 &&
    filterSuggestionResult.key === suggestionKey
      ? filterSuggestionResult.items
      : [];

  useEffect(() => {
    if (loading || !response || response.total > 0) return;
    const candidates: Array<{ label: string; filters: ScreenerFilters }> = [];
    if (filters.minimumScore > 0) candidates.push({
      label: `Lower minimum opportunity score to ${Math.max(0, filters.minimumScore - 5)}`,
      filters: { ...filters, minimumScore: Math.max(0, filters.minimumScore - 5) },
    });
    if (filters.minimumIncomeGrowth > defaultFilters.minimumIncomeGrowth) candidates.push({
      label: `Lower minimum income growth to ${formatPercent(Math.max(defaultFilters.minimumIncomeGrowth, filters.minimumIncomeGrowth - 0.005), true)}`,
      filters: { ...filters, minimumIncomeGrowth: Math.max(defaultFilters.minimumIncomeGrowth, filters.minimumIncomeGrowth - 0.005) },
    });
    if (filters.minimumGrossYield > 0) candidates.push({
      label: `Lower minimum gross-yield proxy to ${formatPercent(Math.max(0, filters.minimumGrossYield - 0.005))}`,
      filters: { ...filters, minimumGrossYield: Math.max(0, filters.minimumGrossYield - 0.005) },
    });
    if (filters.maximumVacancy < defaultFilters.maximumVacancy) candidates.push({
      label: `Raise maximum vacancy to ${formatPercent(Math.min(defaultFilters.maximumVacancy, filters.maximumVacancy + 0.02))}`,
      filters: { ...filters, maximumVacancy: Math.min(defaultFilters.maximumVacancy, filters.maximumVacancy + 0.02) },
    });
    if (!candidates.length) return;
    const controller = new AbortController();
    void Promise.all(candidates.map(async (candidate) => {
      const result = await fetch(apiUrl(candidate.filters, 1), { signal: controller.signal });
      const payload = result.ok ? await result.json() as AreaResponse : null;
      return { ...candidate, count: payload?.total ?? 0 };
    })).then((items) => setFilterSuggestionResult({
      key: suggestionKey,
      items: items.filter((item) => item.count > 0),
    })).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setFilterSuggestionResult({ key: suggestionKey, items: [] });
      }
    });
    return () => controller.abort();
  }, [filters, loading, response, suggestionKey]);

  useEffect(() => {
    if (view === "map" || !selected) return;
    const frame = requestAnimationFrame(() => {
      const row = document.getElementById(`area-row-${selected.id}`);
      row?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
        inline: "nearest",
      });
      row?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [response?.items, selected, view]);

  useEffect(() => {
    if (!selected || explaining) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const selectedId = selected.id;
        setSelected(null);
        requestAnimationFrame(() => document.getElementById(`area-row-${selectedId}`)?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => document.getElementById("selected-tract-dialog")?.focus());
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [explaining, selected]);

  function selectArea(area: AreaRecord) {
    setSelected(area);
    const areaIndex = response?.mapItems.findIndex((item) => item.id === area.id) ?? -1;
    const selectedPage = areaIndex < 0 ? page : Math.floor(areaIndex / 20) + 1;
    if (selectedPage !== page) {
      setPage(selectedPage);
      setLoading(true);
    }
  }

  function closeSelectedArea() {
    const selectedId = selected?.id;
    setSelected(null);
    if (selectedId) requestAnimationFrame(() => document.getElementById(`area-row-${selectedId}`)?.focus());
  }

  function applyFilters() {
    setLoading(true);
    setPage(1);
    setFilters(draft);
    setSelected(null);
  }

  function applyInvestorSearch() {
    const selectedInvestorStrategy = investorStrategies.find((item) => item.key === investorSearch.strategy);
    const scoreStrategy = strategies.find((item) => item.key === selectedInvestorStrategy?.scoreStrategy) ?? builtInStrategies[0];
    const maximumVacancy = investorSearch.riskTolerance === "conservative"
      ? 0.1
      : investorSearch.riskTolerance === "moderate"
        ? 0.18
        : defaultFilters.maximumVacancy;
    const next: ScreenerFilters = {
      ...draft,
      search: investorSearch.neighborhoodPreferences.trim(),
      maximumVacancy,
      strategyKey: scoreStrategy.key,
      strategyName: scoreStrategy.name,
      strategyVersion: scoreStrategy.version,
      strategyWeights: scoreStrategy.weights,
    };
    setDraft(next);
    setFilters(next);
    setPage(1);
    setSelected(null);
    setLoading(true);
    setSearchApplied(true);
    window.localStorage.setItem("nii-investor-search", JSON.stringify(investorSearch));
  }

  function resetFilters() {
    setDraft(defaultFilters);
    setFilters(defaultFilters);
    setPage(1);
    setSelected(null);
    setLoading(true);
  }

  function setCityFocus(city: ScreenerFilters["city"]) {
    setDraft((current) => ({ ...current, city }));
    setFilters((current) => ({ ...current, city }));
    setPage(1);
    setSelected(null);
    setLoading(true);
  }

  function updateSort(sort: SortKey, direction?: "asc" | "desc") {
    const sortDirection =
      direction ??
      (filters.sort === sort
        ? filters.sortDirection === "asc" ? "desc" : "asc"
        : sort === "area" || sort === "vacancyRate" ? "asc" : "desc");
    setDraft((current) => ({ ...current, sort, sortDirection }));
    setFilters((current) => ({ ...current, sort, sortDirection }));
    setPage(1);
    setLoading(true);
  }

  async function saveFilterSet() {
    setSaveMessage("");
    const result = await fetch("/api/saved-filter-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Market screen ${new Date().toLocaleDateString()}`, query: filters }),
    });
    if (result.ok) setSaveMessage("Filter set saved to your private workspace.");
    else setSaveMessage("Sign-in or storage setup is required before this filter can be saved.");
  }

  return (
    <div className="app-shell">
      <AppNavigation />
      <main className="main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="global-search">
            <span className="search-mark" aria-hidden="true">⌕</span>
            <input
              aria-label="Search supported areas"
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
              placeholder="Search neighborhood, city, county, or tract"
              value={draft.search}
            />
            <span className="search-key" aria-hidden="true">↵</span>
          </div>
          <div className="topbar-meta">
            <span>Core ACS {coverage.scoreReferenceYear}</span>
            <span className="health">Data healthy</span>
            <span className="user-chip" aria-label="Private workspace">OH</span>
          </div>
        </header>

        <div className="page screener-page">
          <div className="page-head screener-page-head">
            <div>
              <p className="eyebrow">Investor workflow · Step 1</p>
              <h1>Discover Markets</h1>
              <p>
                Define your buy box, understand why an area ranks, and carry your deal targets into property analysis.
              </p>
            </div>
            <div className="actions">
              <button className="button" onClick={() => void saveFilterSet()}>Save filter set</button>
              <a className="button" href={`/api/areas/export?${filtersToSearch(filters, 1, 10000)}`}>Export CSV</a>
            </div>
          </div>
          <section className="investor-search-card" aria-labelledby="investor-search-title">
            <div className="investor-search-head">
              <div>
                <p className="eyebrow">Investment search</p>
                <h2 id="investor-search-title">What are you looking to buy?</h2>
                <p>Market criteria rank neighborhoods. Deal-return targets are saved for property analysis and never presented as area-level returns.</p>
              </div>
              <div className="investor-journey" aria-label="Investor workflow">
                <span className="active">1 Discover</span><span>2 Analyze</span><span>3 Compare</span><span>4 Save</span>
              </div>
            </div>
            <form className="investor-search-form" onSubmit={(event) => { event.preventDefault(); applyInvestorSearch(); }}>
              <div className="investor-search-grid investor-search-grid-primary">
                <div className="investor-market-field">
                  <span className="investor-field-label">Market or metro</span>
                  <MarketCombobox markets={markets} value={draft.city} onChange={setCityFocus} />
                </div>
                <label className="field">
                  <span>Investment strategy</span>
                  <select value={investorSearch.strategy} onChange={(event) => setInvestorSearch({ ...investorSearch, strategy: event.target.value })}>
                    {investorStrategies.map((strategy) => <option value={strategy.key} key={strategy.key}>{strategy.label}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Risk tolerance</span>
                  <select value={investorSearch.riskTolerance} onChange={(event) => setInvestorSearch({ ...investorSearch, riskTolerance: event.target.value as InvestorSearch["riskTolerance"] })}>
                    <option value="conservative">Conservative</option>
                    <option value="moderate">Moderate</option>
                    <option value="opportunistic">Opportunistic</option>
                  </select>
                </label>
              </div>
              <details className="investor-search-advanced">
                <summary>Deal targets and financing</summary>
                <div className="investor-search-grid">
                  <InvestorNumberField label="Minimum purchase price" prefix="$" step={10_000} min={0} value={investorSearch.minimumPrice} onChange={(value) => setInvestorSearch({ ...investorSearch, minimumPrice: value })} />
                  <InvestorNumberField label="Maximum purchase price" prefix="$" step={10_000} min={0} value={investorSearch.maximumPrice} onChange={(value) => setInvestorSearch({ ...investorSearch, maximumPrice: value })} />
                  <InvestorNumberField label="Minimum cash-on-cash" suffix="%" step={0.1} min={0} value={investorSearch.minimumCashOnCash * 100} onChange={(value) => setInvestorSearch({ ...investorSearch, minimumCashOnCash: value / 100 })} />
                  <InvestorNumberField label="Minimum cap rate" suffix="%" step={0.1} min={0} value={investorSearch.minimumCapRate * 100} onChange={(value) => setInvestorSearch({ ...investorSearch, minimumCapRate: value / 100 })} />
                  <InvestorNumberField label="Minimum DSCR" step={0.05} min={0} value={investorSearch.minimumDscr} onChange={(value) => setInvestorSearch({ ...investorSearch, minimumDscr: value })} />
                  <InvestorNumberField label="Maximum renovation" prefix="$" step={5_000} min={0} value={investorSearch.maximumRenovation} onChange={(value) => setInvestorSearch({ ...investorSearch, maximumRenovation: value })} />
                  <InvestorNumberField label="Down payment" suffix="%" step={1} min={0} max={100} value={investorSearch.downPayment * 100} onChange={(value) => setInvestorSearch({ ...investorSearch, downPayment: value / 100 })} />
                  <InvestorNumberField label="Interest rate" suffix="%" step={0.05} min={0} max={30} value={investorSearch.interestRate * 100} onChange={(value) => setInvestorSearch({ ...investorSearch, interestRate: value / 100 })} />
                  <label className="field investor-preference-field">
                    <span>Neighborhood preferences</span>
                    <input value={investorSearch.neighborhoodPreferences} onChange={(event) => setInvestorSearch({ ...investorSearch, neighborhoodPreferences: event.target.value })} placeholder="Optional neighborhood, corridor, or county" />
                  </label>
                </div>
              </details>
              <div className="investor-search-actions">
                <button className="button primary" type="submit">Find matching markets</button>
                <a className="text-button" href="/settings/strategies">Advanced Strategy Settings</a>
                {searchApplied ? <a className="button" href={propertyHref}>Continue to properties</a> : null}
              </div>
            </form>
          </section>
          <DataVintageNotice coverage={coverage} />
          {saveMessage ? <p className="status-message" role="status">{saveMessage}</p> : null}

          <div className="workspace screener-workspace">
            <aside className="panel filters" aria-label="Opportunity filters">
              <div className="panel-head">
                <h2>Screening filters</h2>
                <button className="text-button" onClick={resetFilters}>Reset</button>
              </div>
              <div className="filter-section city-focus-section">
                <h3>Market geography</h3>
                <MarketCombobox markets={markets} value={draft.city} onChange={setCityFocus} />
                <p className="filter-hint">
                  City-proper boundaries are used for supported markets. Metro definitions are
                  shown separately and are not silently substituted for city boundaries.
                </p>
              </div>
              <div className="filter-section">
                <h3>Strategy</h3>
                <div className="field">
                  <label htmlFor="strategy">Preset</label>
                  <select
                    id="strategy"
                    value={draft.strategyKey}
                    onChange={(event) => {
                      const strategy = strategies.find((item) => item.key === event.target.value);
                      if (!strategy) return;
                      const strategyFields = {
                        strategyKey: strategy.key,
                        strategyName: strategy.name,
                        strategyVersion: strategy.version,
                        strategyWeights: strategy.weights,
                      };
                      setDraft({ ...draft, ...strategyFields });
                      setFilters({ ...filters, ...strategyFields });
                      setPage(1);
                      setSelected(null);
                      setLoading(true);
                    }}
                  >
                    {strategies.map((strategy) => (
                      <option value={strategy.key} key={strategy.key}>
                        {strategy.name} v{strategy.version}{strategy.owner === "user" ? " (mine)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="strategy-explainer">
                  <strong>{selectedStrategy?.name ?? draft.strategyName}</strong>
                  <p>
                    {selectedStrategy?.description ??
                      "Uses your saved component weights to rank the supported tracts."}
                  </p>
                  <div className="strategy-weight-list">
                    {leadingWeights.map((item) => (
                      <span key={item.label}>{item.label} {Math.round(item.weight * 100)}%</span>
                    ))}
                  </div>
                  <small>
                    Presets immediately recalculate the opportunity score and rank. Observed
                    income, home value, growth, yield, and vacancy do not change.
                  </small>
                </div>
                <a className="text-button" href="/settings/strategies">Create custom strategy</a>
              </div>
              <div className="filter-section">
                <h3>Momentum & value</h3>
                <RangeField
                  label="Minimum opportunity score"
                  min={0}
                  max={90}
                  step={5}
                  value={draft.minimumScore}
                  output={`${draft.minimumScore}+`}
                  onChange={(value) => setDraft({ ...draft, minimumScore: value })}
                />
                <RangeField
                  label="Minimum real income growth"
                  min={-0.03}
                  max={0.08}
                  step={0.005}
                  value={draft.minimumIncomeGrowth}
                  output={formatPercent(draft.minimumIncomeGrowth, true)}
                  onChange={(value) => setDraft({ ...draft, minimumIncomeGrowth: value })}
                />
                <RangeField
                  label="Minimum gross-yield proxy"
                  min={0}
                  max={0.12}
                  step={0.005}
                  value={draft.minimumGrossYield}
                  output={formatPercent(draft.minimumGrossYield)}
                  onChange={(value) => setDraft({ ...draft, minimumGrossYield: value })}
                />
              </div>
              <div className="filter-section">
                <h3>Risk controls</h3>
                <RangeField
                  label="Maximum rental vacancy"
                  min={0.02}
                  max={0.3}
                  step={0.01}
                  value={draft.maximumVacancy}
                  output={formatPercent(draft.maximumVacancy)}
                  onChange={(value) => setDraft({ ...draft, maximumVacancy: value })}
                />
                <div className="field unsupported"><span>Violent crime trend</span><span>State only</span></div>
                <div className="field unsupported"><span>FEMA flood context</span><span>Map layer</span></div>
                <div className="field unsupported"><span>DC regulation profile</span><span>Signals page</span></div>
              </div>
              <div className="filter-section">
                <button className="button primary" onClick={applyFilters} style={{ width: "100%" }}>
                  Apply {activeFilterCount ? `${activeFilterCount} filters` : "filters"}
                </button>
              </div>
            </aside>

            <section className="panel results screener-results" aria-busy={loading}>
              <div className="results-toolbar">
                <div className="result-count">
                  {loading ? "Loading…" : `${response?.total ?? 0} opportunities`}{" "}
                  <span>match</span>
                </div>
                <div className="toolbar-spacer" />
                {compareIds.length ? (
                  <a className="button" href={`/compare?ids=${compareIds.join(",")}`}>
                    Compare {compareIds.length}
                  </a>
                ) : null}
                <label className="field" style={{ margin: 0 }}>
                  <span className="sr-only">Sort results</span>
                  <select
                    aria-label="Sort results"
                    onChange={(event) => {
                      const sort = event.target.value as SortKey;
                      updateSort(
                        sort,
                        sort === "area" || sort === "vacancyRate" ? "asc" : "desc",
                      );
                    }}
                    value={filters.sort}
                  >
                    <option value="area">Area name</option>
                    <option value="score">Opportunity score</option>
                    <option value="medianHouseholdIncome">Household income</option>
                    <option value="medianHomeValue">Median home value</option>
                    <option value="incomeGrowth">Income growth</option>
                    <option value="populationGrowth">Population growth</option>
                    <option value="grossYieldProxy">Gross-yield proxy</option>
                    <option value="vacancyRate">Rental vacancy</option>
                    <option value="metricCoverage">Data quality</option>
                  </select>
                </label>
                <button
                  className="sort-direction"
                  onClick={() =>
                    updateSort(
                      filters.sort,
                      filters.sortDirection === "asc" ? "desc" : "asc",
                    )
                  }
                  aria-label={`Sort ${filters.sortDirection === "asc" ? "descending" : "ascending"}`}
                  title={`Currently ${filters.sortDirection === "asc" ? "ascending" : "descending"}`}
                >
                  {filters.sortDirection === "asc" ? "↑" : "↓"}
                </button>
                <div className="segmented" aria-label="Results view">
                  {(["split", "map", "table"] as const).map((choice) => (
                    <button
                      className={view === choice ? "active" : ""}
                      key={choice}
                      onClick={() => setView(choice)}
                    >
                      {choice[0].toUpperCase() + choice.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {error ? (
                <div className="method-note" role="alert">
                  {error} Your filters are preserved.{" "}
                  <button
                    className="text-button"
                    onClick={() => {
                      setLoading(true);
                      setRetryToken((value) => value + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div
                  className={`split screener-split split-${view}`}
                  style={{
                    gridTemplateColumns:
                      view === "map" ? "1fr" : view === "table" ? "1fr" : undefined,
                  }}
                >
                  {view !== "table" ? (
                    <OpportunityMap
                      areas={response?.mapItems ?? []}
                      contextAreas={[]}
                      marketSummaries={response?.marketSummaries ?? []}
                      mapTotal={response?.mapTotal ?? 0}
                      mapTruncated={response?.mapTruncated ?? false}
                      focusCity={filters.city}
                      selectedId={selected?.id ?? null}
                      hoveredId={hoveredId}
                      comparedIds={compareIds}
                      loading={loading}
                      focusLabel={markets.find((item) => item.id === filters.city)?.label ?? "All supported cities"}
                      onHover={setHoveredId}
                      onSelect={selectArea}
                      onFocusCity={setCityFocus}
                    />
                  ) : null}
                  {view !== "map" ? (
                    <AreaTable
                      areas={response?.items ?? []}
                      selectedId={selected?.id ?? null}
                      hoveredId={hoveredId}
                      onHover={setHoveredId}
                      onExplain={setExplaining}
                      onSelect={selectArea}
                      compareIds={compareIds}
                      onToggleCompare={(areaId) =>
                        setCompareIds((current) =>
                          current.includes(areaId)
                            ? current.filter((id) => id !== areaId)
                            : current.length < 4
                              ? [...current, areaId]
                              : current,
                        )
                      }
                      sort={filters.sort}
                      sortDirection={filters.sortDirection}
                      onSort={updateSort}
                      marketCenters={marketCenters}
                      dataYear={coverage.scoreReferenceYear}
                      filters={filters}
                      suggestions={filterSuggestions}
                      onApplySuggestion={(suggestion) => {
                        setDraft(suggestion);
                        setFilters(suggestion);
                        setPage(1);
                        setLoading(true);
                      }}
                      onReset={resetFilters}
                    />
                  ) : null}
                </div>
              )}
              <div className="pagination">
                <span>
                  Page {response?.page ?? page} of {response?.pageCount ?? 1}
                </span>
                <div className="pagination-controls">
                  <button
                    aria-label="Previous page"
                    disabled={page <= 1}
                    onClick={() => {
                      setLoading(true);
                      setPage((current) => Math.max(1, current - 1));
                    }}
                  >
                    ‹
                  </button>
                  <button
                    aria-label="Next page"
                    disabled={page >= (response?.pageCount ?? 1)}
                    onClick={() => {
                      setLoading(true);
                      setPage((current) => current + 1);
                    }}
                  >
                    ›
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {selected && !explaining ? (
        <>
        <button className="drawer-backdrop" onClick={closeSelectedArea} aria-label="Close selected tract summary" />
        <section className="drawer" aria-labelledby="selected-tract-title" aria-modal="true" id="selected-tract-dialog" role="dialog" tabIndex={-1}>
          <button className="drawer-close" onClick={closeSelectedArea} aria-label="Close">×</button>
          <p className="eyebrow">Selected area</p>
          <h2 id="selected-tract-title">{investorAreaName(selected, marketCenters[selected.marketId])}</h2>
          <p className="drawer-lead">{selected.city}, {selected.stateAbbr} · {selected.county} · {selected.tractLabel}</p>
          {selected.nameConfidence !== "high" ? <p className="label-confidence-note">Neighborhood label is approximate. Census tract remains the auditable geography.</p> : null}
          <div className="score-hero">
            <span className="score">{selected.score?.toFixed(0) ?? "—"}</span>
            <div><strong>{filters.strategyName}</strong><span>v{filters.strategyVersion} | {formatPercent(selected.metrics.metricCoverage)} coverage</span></div>
          </div>
          <div className="metric-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <MetricMini label="Household income" value={formatCurrency(selected.metrics.medianHouseholdIncome)} />
            <MetricMini label="Income growth" value={formatPercent(selected.metrics.incomeGrowth, true)} />
            <MetricMini label="Median home value" value={formatCurrency(selected.metrics.medianHomeValue)} />
            <MetricMini label="Gross-yield proxy" value={formatPercent(selected.metrics.grossYieldProxy)} />
          </div>
          <AreaInsightSummary area={selected} />
          <div className="actions" style={{ marginTop: 18 }}>
            <a className="button primary" href={`/areas/${selected.id}`}>Open area profile</a>
            <a className="button" href={appendContext("/properties", { version: 1, marketId: selected.marketId, tractGeoid: selected.tractGeoid ?? selected.id, strategyVersion: filters.strategyVersion, returnTo: "/" })}>Find properties in this tract</a>
            <button className="button" onClick={() => setExplaining(selected)}>Explain score</button>
          </div>
          <div className="method-note">{selected.quality.warning}</div>
        </section>
        </>
      ) : null}

      {explaining ? (
        <>
          <button className="drawer-backdrop" onClick={() => setExplaining(null)} aria-label="Close score explanation" />
          <ScoreDrawer area={explaining} center={marketCenters[explaining.marketId]} filters={filters} onClose={() => setExplaining(null)} />
        </>
      ) : null}
    </div>
  );
}

function InvestorNumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="field investor-number-field">
      <span>{label}</span>
      <span className="investor-input-wrap">
        {prefix ? <b aria-hidden="true">{prefix}</b> : null}
        <input
          aria-label={label}
          inputMode="decimal"
          max={max}
          min={min}
          step={step}
          type="number"
          value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <b aria-hidden="true">{suffix}</b> : null}
      </span>
    </label>
  );
}

function RangeField({
  label,
  min,
  max,
  step,
  value,
  output,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  output: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <label><span>{label}</span><output>{output}</output></label>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong></div>;
}

function AreaInsightSummary({ area }: { area: AreaRecord }) {
  const insight = areaDecisionInsight(area);
  return (
    <div className="area-insight-summary">
      <div><span>Why it ranks</span><strong>{insight.primaryPositive}</strong></div>
      <div><span>Primary risk</span><strong>{insight.primaryRisk}</strong></div>
      <div><span>Market / deal distinction</span><strong>This score evaluates the area only. Underwrite a property before judging deal quality.</strong></div>
    </div>
  );
}

function MarketCombobox({
  markets,
  value,
  onChange,
}: {
  markets: MarketDefinition[];
  value: ScreenerFilters["city"];
  onChange: (value: ScreenerFilters["city"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const enabledMarkets = useMemo(
    () => markets.filter((market) => market.enabled && market.geographyType === "place"),
    [markets],
  );
  const visibleMarkets = enabledMarkets.filter((market) =>
    `${market.city} ${market.state} ${market.stateAbbr}`.toLowerCase().includes(query.toLowerCase()),
  );
  const selectedMarket = enabledMarkets.find((market) => market.id === value);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function choose(nextValue: ScreenerFilters["city"]) {
    onChange(nextValue);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="market-combobox" ref={rootRef}>
      <button
        aria-controls="market-options"
        aria-expanded={open}
        className="market-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>
          <strong>{selectedMarket ? `${selectedMarket.city}, ${selectedMarket.stateAbbr}` : "All supported cities"}</strong>
          <small>{selectedMarket ? "City-proper market" : "Compare available city-proper markets"}</small>
        </span>
        <b aria-hidden="true">{open ? "⌃" : "⌄"}</b>
      </button>
      {open ? (
        <div className="market-popover" id="market-options" role="listbox">
          <label className="market-search">
            <span aria-hidden="true">⌕</span>
            <input
              autoFocus
              aria-label="Search cities"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
              placeholder="Search city or state"
              value={query}
            />
          </label>
          {!query ? (
            <button
              aria-selected={value === "all"}
              className={`market-option ${value === "all" ? "selected" : ""}`}
              onClick={() => choose("all")}
              role="option"
              type="button"
            >
              <span><strong>All supported cities</strong><small>Compare available markets</small></span>
              {value === "all" ? <b aria-hidden="true">✓</b> : null}
            </button>
          ) : null}
          <div className="market-option-heading">City proper</div>
          {visibleMarkets.map((market) => (
            <button
              aria-selected={value === market.id}
              className={`market-option ${value === market.id ? "selected" : ""}`}
              key={market.id}
              onClick={() => choose(market.id as ScreenerFilters["city"])}
              role="option"
              type="button"
            >
              <span><strong>{market.city}, {market.stateAbbr}</strong><small>City boundary</small></span>
              {value === market.id ? <b aria-hidden="true">✓</b> : null}
            </button>
          ))}
          {!visibleMarkets.length ? <p className="market-empty">No integrated city matches that search.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function AreaTable({
  areas,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  onExplain,
  compareIds,
  onToggleCompare,
  sort,
  sortDirection,
  onSort,
  marketCenters,
  dataYear,
  filters,
  suggestions,
  onApplySuggestion,
  onReset,
}: {
  areas: AreaRecord[];
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (areaId: string | null) => void;
  onSelect: (area: AreaRecord) => void;
  onExplain: (area: AreaRecord) => void;
  compareIds: string[];
  onToggleCompare: (areaId: string) => void;
  sort: SortKey;
  sortDirection: "asc" | "desc";
  onSort: (sort: SortKey) => void;
  marketCenters: Record<string, MarketCenter>;
  dataYear: number;
  filters: ScreenerFilters;
  suggestions: FilterSuggestion[];
  onApplySuggestion: (filters: ScreenerFilters) => void;
  onReset: () => void;
}) {
  if (!areas.length) {
    return (
      <div className="filter-empty-state" role="status">
        <p className="eyebrow">No exact matches</p>
        <h3>Your current constraints are tighter than the available market evidence.</h3>
        <div className="active-constraint-list">
          {filters.minimumScore > 0 ? <span>Opportunity score {filters.minimumScore}+</span> : null}
          {filters.minimumGrossYield > 0 ? <span>Yield proxy {formatPercent(filters.minimumGrossYield)}+</span> : null}
          {filters.minimumIncomeGrowth > defaultFilters.minimumIncomeGrowth ? <span>Income growth {formatPercent(filters.minimumIncomeGrowth, true)}+</span> : null}
          {filters.maximumVacancy < defaultFilters.maximumVacancy ? <span>Vacancy at or below {formatPercent(filters.maximumVacancy)}</span> : null}
          {filters.search ? <span>Preference: {filters.search}</span> : null}
        </div>
        {suggestions.length ? (
          <div className="filter-suggestion-list">
            <strong>Nearest adjustments</strong>
            {suggestions.map((suggestion) => (
              <button className="filter-suggestion" key={suggestion.label} onClick={() => onApplySuggestion(suggestion.filters)}>
                <span>{suggestion.label}</span><b>{suggestion.count.toLocaleString()} results</b>
              </button>
            ))}
          </div>
        ) : <p>Broaden the neighborhood search or reset the advanced market filters.</p>}
        <button className="button" onClick={onReset}>Reset market filters</button>
      </div>
    );
  }
  return (
    <div className="table-wrap screener-area-table-wrap">
      <table className="area-table">
        <thead>
          <tr>
            <th><span className="sr-only">Compare</span></th>
            <SortHeader label="Opportunity" sortKey="area" activeSort={sort} direction={sortDirection} onSort={onSort} />
            <SortHeader label="Score" sortKey="score" activeSort={sort} direction={sortDirection} onSort={onSort} />
            <th>Market / demand</th>
            <SortHeader label="Value" sortKey="medianHomeValue" activeSort={sort} direction={sortDirection} onSort={onSort} />
            <SortHeader label="Rental economics" sortKey="grossYieldProxy" activeSort={sort} direction={sortDirection} onSort={onSort} />
            <SortHeader label="Momentum" sortKey="incomeGrowth" activeSort={sort} direction={sortDirection} onSort={onSort} />
            <th>Risk</th>
            <SortHeader label="Confidence" sortKey="metricCoverage" activeSort={sort} direction={sortDirection} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => {
            const insight = areaDecisionInsight(area);
            const areaLabel = investorAreaName(area, marketCenters[area.marketId]);
            return (
            <tr
              className={`${selectedId === area.id ? "selected" : ""} ${hoveredId === area.id ? "hovered" : ""}`}
              id={`area-row-${area.id}`}
              key={area.id}
              tabIndex={0}
              onClick={() => onSelect(area)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(area);
              }}
              onMouseEnter={() => onHover(area.id)}
              onMouseLeave={() => onHover(null)}
            >
              <td>
                <input
                  aria-label={`Compare ${areaLabel}`}
                  checked={compareIds.includes(area.id)}
                  disabled={!compareIds.includes(area.id) && compareIds.length >= 4}
                  type="checkbox"
                  onChange={() => onToggleCompare(area.id)}
                  onClick={(event) => event.stopPropagation()}
                />
              </td>
              <td className="area-name">
                <a href={`/areas/${area.id}`} onClick={(event) => event.stopPropagation()}>
                  <strong>{areaLabel}</strong>
                  <span>{area.city}, {area.stateAbbr} · {area.metro}</span>
                  <small>{area.tractLabel} · ZIP crosswalk pending · Label confidence {area.nameConfidence}</small>
                </a>
                <p className="area-thesis">{insight.thesis}</p>
              </td>
              <td>
                <button
                  className="score"
                  aria-label={`Explain ${area.name} score`}
                  onClick={(event) => { event.stopPropagation(); onExplain(area); }}
                >
                  {area.score?.toFixed(0) ?? "—"}
                </button>
              </td>
              <td><strong>{insight.marketQualityScore?.toFixed(0) ?? "—"}</strong><span className="metric-sub">Rental market {insight.rentalDemandScore?.toFixed(0) ?? "—"}</span></td>
              <td>{formatCurrency(area.metrics.medianHomeValue)}<span className="metric-sub">Rent {formatCurrency(area.metrics.medianGrossRent)}/mo · Value score {insight.valuationScore?.toFixed(0) ?? "—"}</span></td>
              <td>{formatPercent(area.metrics.grossYieldProxy)}<span className="metric-sub">Vacancy {formatPercent(area.metrics.vacancyRate)}</span></td>
              <td>{formatPercent(area.metrics.incomeGrowth, true)}<span className="metric-sub">Population {formatPercent(area.metrics.populationGrowth, true)}</span></td>
              <td><span className={`risk-chip risk-${insight.riskLabel.toLowerCase()}`}>{insight.riskLabel}</span><span className="metric-sub">{insight.primaryRisk}</span></td>
              <td><span className="quality">{insight.dataConfidence}</span><span className="metric-sub">{formatPercent(area.metrics.metricCoverage)} · ACS {dataYear}</span></td>
            </tr>
          );})}
        </tbody>
      </table>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  activeSort,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  direction: "asc" | "desc";
  onSort: (sort: SortKey) => void;
}) {
  const active = activeSort === sortKey;
  return (
    <th aria-sort={active ? direction === "asc" ? "ascending" : "descending" : "none"}>
      <button className={`column-sort ${active ? "active" : ""}`} onClick={() => onSort(sortKey)}>
        {label}<span aria-hidden="true">{active ? direction === "asc" ? "↑" : "↓" : "↕"}</span>
      </button>
    </th>
  );
}

function ScoreDrawer({
  area,
  center,
  filters,
  onClose,
}: {
  area: AreaRecord;
  center?: MarketCenter;
  filters: ScreenerFilters;
  onClose: () => void;
}) {
  const insight = areaDecisionInsight(area);
  return (
    <aside className="drawer" aria-modal="true" role="dialog" aria-labelledby="score-title">
      <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
      <p className="eyebrow">Explainable score</p>
      <h2 id="score-title">{investorAreaName(area, center)}</h2>
      <p className="drawer-lead">
        Percentile-based components within the currently supported tract cohort. This is a
        ranking aid, not an investment recommendation.
      </p>
      <div className="score-hero">
        <span className="score">{area.score?.toFixed(0) ?? "—"}</span>
        <div>
          <strong>{filters.strategyName}</strong>
          <span>v{filters.strategyVersion} | {formatPercent(area.metrics.metricCoverage)} coverage</span>
        </div>
      </div>
      <div className="score-explanation-grid">
        <section>
          <span>Positive contributors</span>
          {insight.positiveContributors.map((item) => <strong key={item.key}>{item.label} · {item.score.toFixed(0)}</strong>)}
        </section>
        <section>
          <span>Negative contributors</span>
          {insight.negativeContributors.map((item) => <strong key={item.key}>{item.label} · {item.score.toFixed(0)}</strong>)}
        </section>
        <section>
          <span>Missing evidence</span>
          <strong>{insight.missingFactors.length ? insight.missingFactors.join(", ") : "No score components missing"}</strong>
          <small>National-relative percentile is not available and is not inferred.</small>
        </section>
      </div>
      {scoreDefinitions.map((definition) => {
        const value = area.scores[definition.key];
        return (
          <div className="score-row" key={definition.key}>
            <div><strong>{definition.label}</strong><span className="metric-sub">{definition.evidence} | {Math.round(filters.strategyWeights[definition.key] * 100)}% weight</span></div>
            <strong>{value?.toFixed(0) ?? "—"}</strong>
            <div className="score-bar" aria-label={`${definition.label}: ${value ?? "not available"}`}>
              <span style={{ width: `${value ?? 0}%` }} />
            </div>
          </div>
        );
      })}
      <div className="method-note">
        The score uses the saved weights for {filters.strategyName} v{filters.strategyVersion}. Missing components are excluded and remaining weights are renormalized. Values are observed or explicitly derived from ACS data. {area.quality.warning}
      </div>
      <a className="button primary" href={`/areas/${area.id}`} style={{ marginTop: 18 }}>Open full area profile</a>
    </aside>
  );
}
