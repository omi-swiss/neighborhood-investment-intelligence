"use client";

import { useEffect, useMemo, useState } from "react";
import type { PropertyMarketDirectoryEntry } from "../data/property-markets";
import type { QualifiedSale } from "../lib/remaining-gaps";

type DirectoryPayload = {
  items: QualifiedSale[];
  total: number;
  page: number;
  pageCount: number;
  totalIsLowerBound?: boolean;
  lookupStatus: "snapshot" | "live" | "search-required" | "temporarily-unavailable";
  message: string;
  source: { name: string; url: string } | null;
  coverage: Array<PropertyMarketDirectoryEntry & {
    recordCount: number | null;
    latestRecordDate: string | null;
  }>;
};

type DirectoryMode = "sales" | "properties" | "prospects";
type SaleWindow = "1" | "3" | "5" | "10" | "all";

function formatCurrency(value: number | null) {
  return value === null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
}

function prospectKey(item: QualifiedSale) {
  return `${item.city}:${item.parcelId}`;
}

function escapeCsv(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function PublicPropertyDirectory({
  markets,
  initialMarketId = "all",
}: {
  markets: PropertyMarketDirectoryEntry[];
  initialMarketId?: string;
}) {
  const [market, setMarket] = useState(initialMarketId);
  const [mode, setMode] = useState<DirectoryMode>("sales");
  const [saleWindow, setSaleWindow] = useState<SaleWindow>("5");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<DirectoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<Record<string, QualifiedSale>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem("nii-prospecting-list");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as QualifiedSale[];
      setSaved(Object.fromEntries(parsed.map((item) => [prospectKey(item), item])));
    } catch {
      window.localStorage.removeItem("nii-prospecting-list");
    }
  }, []);

  useEffect(() => {
    if (mode === "prospects") {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({
      market,
      search: appliedQuery,
      page: String(page),
      view: mode,
      years: saleWindow,
    });
    void fetch(`/api/public-property-directory?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Public property directory could not load.");
        return response.json() as Promise<DirectoryPayload>;
      })
      .then((result) => {
        setPayload(result);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPayload(null);
        setLoading(false);
      });
    return () => controller.abort();
  }, [appliedQuery, market, mode, page, saleWindow]);

  const selectedMarket = markets.find((item) => item.id === market);
  const savedItems = useMemo(() => Object.values(saved), [saved]);
  const visibleSavedItems = useMemo(() => {
    const selectedCity = markets.find((item) => item.id === market)?.city;
    const needle = appliedQuery.trim().toLowerCase();
    return savedItems.filter((item) => {
      if (selectedCity && item.city !== selectedCity) return false;
      if (!needle) return true;
      return [item.address, item.city, item.state, item.neighborhood, item.parcelId, item.propertyType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [appliedQuery, market, markets, savedItems]);
  const prospectPageCount = Math.max(1, Math.ceil(visibleSavedItems.length / 12));
  const prospectItems = visibleSavedItems.slice((page - 1) * 12, page * 12);
  const displayItems = mode === "prospects" ? prospectItems : payload?.items ?? [];
  const displayTotal = mode === "prospects" ? visibleSavedItems.length : payload?.total ?? 0;
  const displayPageCount = mode === "prospects" ? prospectPageCount : payload?.pageCount ?? 1;

  function setMarketFocus(value: string) {
    setMarket(value);
    setQuery("");
    setAppliedQuery("");
    setPage(1);
  }

  function setDirectoryMode(value: DirectoryMode) {
    setMode(value);
    setPage(1);
  }

  function toggleProspect(item: QualifiedSale) {
    const key = prospectKey(item);
    const next = { ...saved };
    if (next[key]) delete next[key];
    else next[key] = item;
    setSaved(next);
    window.localStorage.setItem("nii-prospecting-list", JSON.stringify(Object.values(next)));
  }

  function exportProspects() {
    if (!savedItems.length) return;
    const header = [
      "address",
      "city",
      "state",
      "neighborhood",
      "parcel_id",
      "last_recorded_sale_date",
      "last_recorded_sale_price",
      "public_record_url",
      "contact_status",
      "dnc_status",
      "notes",
    ];
    const rows = savedItems.map((item) => [
      item.address,
      item.city,
      item.state,
      item.neighborhood,
      item.parcelId,
      item.saleDate,
      item.salePrice,
      item.sourceUrl,
      "Research required",
      "Must be checked before outreach",
      "Listing status unknown; verify ownership and lawful contact source.",
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "off-market-property-research-list.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="property-directory">
      <div className="property-directory-hero">
        <div>
          <p className="eyebrow">Property intelligence</p>
          <h2>Search the property universe—not just listings</h2>
          <p>
            Search verified snapshots or live official parcel systems across every supported market.
            A property appearing here does not mean it is listed or that its owner wants to sell.
          </p>
        </div>
      </div>

      <div className="directory-mode-tabs" role="tablist" aria-label="Property research mode">
        <button className={mode === "sales" ? "active" : ""} onClick={() => setDirectoryMode("sales")} role="tab" aria-selected={mode === "sales"}>
          Recent sales
          <small>Last recorded sales · 5 years by default</small>
        </button>
        <button className={mode === "properties" ? "active" : ""} onClick={() => setDirectoryMode("properties")} role="tab" aria-selected={mode === "properties"}>
          All properties
          <small>Parcel and assessment records</small>
        </button>
        <button className={mode === "prospects" ? "active" : ""} onClick={() => setDirectoryMode("prospects")} role="tab" aria-selected={mode === "prospects"}>
          Prospecting list
          <small>Saved parcel research</small>
        </button>
      </div>

      <>
          <div className="directory-toolbar">
            <label className="field">
              <span>Market</span>
              <select value={market} onChange={(event) => setMarketFocus(event.target.value)}>
                <option value="all">All markets</option>
                {markets.map((item) => <option value={item.id} key={item.id}>{item.city}, {item.stateAbbr}</option>)}
              </select>
            </label>
            <label className="field directory-search">
              <span>Address, neighborhood, parcel, PIN, or tract</span>
              <input
                value={query}
                placeholder={selectedMarket?.searchHint ?? "Search public property evidence"}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setAppliedQuery(query);
                    setPage(1);
                  }
                }}
              />
            </label>
            <button className="button primary" onClick={() => { setAppliedQuery(query); setPage(1); }}>Search</button>
            {mode === "sales" ? (
              <label className="field directory-window">
                <span>Sale period</span>
                <select value={saleWindow} onChange={(event) => { setSaleWindow(event.target.value as SaleWindow); setPage(1); }}>
                  <option value="1">Past year</option>
                  <option value="3">Past 3 years</option>
                  <option value="5">Past 5 years</option>
                  <option value="10">Past 10 years</option>
                  <option value="all">All available</option>
                </select>
              </label>
            ) : null}
            {mode === "prospects" ? (
              <button className="button" disabled={!savedItems.length} onClick={exportProspects}>
                Export outreach list ({savedItems.length})
              </button>
            ) : null}
          </div>

          {mode !== "prospects" && payload?.coverage?.length ? (
            <div className="property-universe-coverage" aria-label="Property universe market coverage">
              {payload.coverage.map((item) => (
                <button
                  className={market === item.id ? "property-coverage-card active" : "property-coverage-card"}
                  key={item.id}
                  onClick={() => setMarketFocus(item.id)}
                >
                  <span>{item.city}, {item.stateAbbr}</span>
                  <strong>
                    {item.recordCoverage === "live-official"
                      ? "Live official search"
                      : `${(item.recordCount ?? 0).toLocaleString()} indexed records`}
                  </strong>
                  <small>{item.latestRecordDate ? `Through ${item.latestRecordDate}` : item.dataVintage}</small>
                </button>
              ))}
            </div>
          ) : null}

          {mode !== "prospects" && payload?.message ? (
            <div className={`property-source-status ${payload.lookupStatus}`}>
              <span>{payload.message}</span>
              {payload.source ? <a href={payload.source.url} target="_blank" rel="noreferrer">{payload.source.name}</a> : null}
            </div>
          ) : null}

          {mode === "prospects" ? (
            <div className="prospecting-guardrail">
              <div>
                <strong>Best-practice workflow</strong>
                <span>Parcel evidence → ownership verification → lawful contact source → Do Not Call check → manual outreach log.</span>
              </div>
              <div className="prospecting-links">
                <a href="https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule" target="_blank" rel="noreferrer">FTC calling rules</a>
                <a href="https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business" target="_blank" rel="noreferrer">Email rules</a>
              </div>
            </div>
          ) : null}

          {mode === "prospects" && !visibleSavedItems.length ? (
            <div className="directory-empty">
              <div className="market-monogram" aria-hidden="true">0</div>
              <div>
                <h3>No saved properties yet</h3>
                <p>Open Recent sales or All properties, then add only the records you want to research.</p>
              </div>
              <button className="button primary" onClick={() => setDirectoryMode("properties")}>Browse all properties</button>
            </div>
          ) : null}

          {mode !== "prospects" && !loading && !payload?.total ? (
            <div className="directory-empty">
              <div className="market-monogram" aria-hidden="true">{selectedMarket?.city.slice(0, 2).toUpperCase() ?? "US"}</div>
              <div>
                <h3>
                  {payload?.lookupStatus === "search-required"
                    ? `Search the ${selectedMarket?.city ?? "official"} property universe`
                    : payload?.lookupStatus === "temporarily-unavailable"
                      ? "Official property service is temporarily unavailable"
                      : "No property records match this search"}
                </h3>
                <p>
                  {payload?.message ?? "Try a broader address, neighborhood, parcel, or tract search."}
                </p>
              </div>
              {selectedMarket ? <a className="button primary" href={selectedMarket.officialSourceUrl} target="_blank" rel="noreferrer">Open official property search</a> : null}
            </div>
          ) : null}

          {mode !== "prospects" && loading ? <div className="directory-loading">Loading verified property records…</div> : null}

          {!loading && displayItems.length ? (
            <div className="public-property-card-grid">
              {displayItems.map((item) => {
                const key = prospectKey(item);
                const isSaved = Boolean(saved[key]);
                return (
                  <article className="public-property-card" key={`${key}:${item.saleDate ?? "undated"}`}>
                    <div className="public-property-card-visual">
                      <span>{item.neighborhood ?? `${item.city} property`}</span>
                      <strong>{item.city.slice(0, 2).toUpperCase()}</strong>
                    </div>
                    <div className="public-property-card-body">
                      <div className="property-card-top">
                        <span className="quality">
                          {mode === "prospects"
                            ? "Prospecting research"
                            : item.recordType === "parcel" || (!item.saleDate && !item.salePrice)
                              ? "Official parcel"
                              : "Recorded sale"}
                        </span>
                        <span>
                          {item.saleDate
                            ? `Last recorded sale · ${item.saleDate}`
                            : item.dataVintage
                              ? `Record vintage · ${item.dataVintage}`
                              : "Current public record"}
                        </span>
                      </div>
                      <h3>{item.address ?? "Address unavailable"}</h3>
                      <p>{item.city}, {item.state} · {item.neighborhood ?? "Neighborhood unavailable"}</p>
                      <div className="property-value-stack">
                        <small>{item.salePrice ? "Recorded sale price" : "Assessed / public value"}</small>
                        <strong className="property-price">{formatCurrency(item.salePrice ?? item.assessedValue)}</strong>
                      </div>
                      <div className="public-property-facts">
                        <span>Parcel {item.parcelId}</span>
                        <span>{item.buildingSquareFeet ? `${item.buildingSquareFeet.toLocaleString()} sq ft` : "Building size unavailable"}</span>
                        <span>{item.yearBuilt ? `Built ${item.yearBuilt}` : item.tractGeoid ? `Tract ${item.tractGeoid.slice(-6)}` : "Year built unavailable"}</span>
                      </div>
                      <div className="property-card-actions">
                        <a className="button" href={item.sourceUrl} target="_blank" rel="noreferrer">Official record</a>
                        <button className={isSaved ? "button primary" : "button"} onClick={() => toggleProspect(item)}>
                          {mode === "prospects" ? "Remove from list" : isSaved ? "Saved to prospecting" : "Add to prospecting"}
                        </button>
                      </div>
                      {mode === "prospects" ? (
                        <small>Listing status and seller interest are unknown. Contact information is not supplied or inferred.</small>
                      ) : <small>{item.sourceName}{item.dataVintage ? ` · ${item.dataVintage}` : ""}</small>}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {displayTotal ? (
            <div className="pagination directory-pagination">
              <span>
                {mode !== "prospects" && payload?.totalIsLowerBound ? "At least " : ""}{displayTotal.toLocaleString()} matching records · Page {page} of {displayPageCount}
              </span>
              <div className="pagination-controls">
                <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
                <button disabled={page >= displayPageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </div>
          ) : null}
      </>
    </section>
  );
}
