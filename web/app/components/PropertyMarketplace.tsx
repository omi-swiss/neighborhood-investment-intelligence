"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseCsv } from "../lib/csv";
import type { PropertyWithDerived } from "../lib/property-domain";
import { PROPERTY_TYPES } from "../lib/property-types";
import { PropertyMap } from "./PropertyMap";

type ResponsePayload = {
  items: PropertyWithDerived[];
  mapItems: PropertyWithDerived[];
  total: number;
  page: number;
  pageCount: number;
};

export type Filters = {
  search: string;
  city: string;
  tractGeoid: string;
  propertyType: string;
  maximumPrice: number;
  minimumGrossYield: number;
  minimumCompleteness: number;
};

const defaultFilters: Filters = {
  search: "",
  city: "",
  tractGeoid: "",
  propertyType: "",
  maximumPrice: 10_000_000,
  minimumGrossYield: 0,
  minimumCompleteness: 0,
};

function formatCurrency(value: number | null) {
  return value === null
    ? "Not available"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null) {
  return value === null
    ? "Not available"
    : new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function queryFor(filters: Filters, page: number) {
  return new URLSearchParams({
    search: filters.search,
    city: filters.city,
    tractGeoid: filters.tractGeoid,
    propertyType: filters.propertyType,
    maximumPrice: String(filters.maximumPrice),
    minimumGrossYield: String(filters.minimumGrossYield),
    minimumCompleteness: String(filters.minimumCompleteness),
    page: String(page),
    pageSize: "24",
  });
}

export function PropertyMarketplace({
  initialFilters = defaultFilters,
  initialIntake,
  markets,
}: {
  initialFilters?: Filters;
  initialIntake?: "manual";
  markets: Array<{ city: string; stateAbbr: string }>;
}) {
  const [draft, setDraft] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<ResponsePayload | null>(null);
  const [selected, setSelected] = useState<PropertyWithDerived | null>(null);
  const [view, setView] = useState<"cards" | "map">("cards");
  const [showImport, setShowImport] = useState(initialIntake === "manual");
  const [importMode, setImportMode] = useState<"csv" | "manual">(initialIntake === "manual" ? "manual" : "csv");
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/properties?${queryFor(filters, page)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to use your private property workspace." : "Property search failed.");
        return response.json() as Promise<ResponsePayload>;
      })
      .then((result) => {
        if (!cancelled) {
          setPayload(result);
          setLoading(false);
          setLoadError("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoading(false);
          setLoadError(error instanceof Error ? error.message : "Property search failed.");
        }
      });
    return () => { cancelled = true; };
  }, [filters, page, refresh]);

  const hasProperties = (payload?.total ?? 0) > 0;
  const activeCount = useMemo(
    () => Object.entries(filters).filter(([key, value]) => value !== defaultFilters[key as keyof Filters]).length,
    [filters],
  );

  async function saveSearch() {
    if (!searchName.trim()) return;
    const response = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: searchName, searchType: "property", query: filters }),
    });
    setSaveMessage(response.ok ? "Search saved and monitoring enabled." : "Search could not be saved.");
    if (response.ok) {
      setSearchName("");
      setShowSaveSearch(false);
    }
  }

  function openListingIntake() {
    setImportMode("manual");
    setShowImport(true);
  }

  return (
    <>
      <div className="marketplace-context-strip">
        <div>
          <strong>{filters.tractGeoid ? `Tract ${filters.tractGeoid} authorized properties` : filters.city ? `${filters.city} authorized properties` : "All markets"}</strong>
          <span>{payload?.total ?? 0} matching private records</span>
        </div>
        <span>Every record retains its source, permission basis, and observation date.</span>
      </div>
      <div className="workspace property-workspace">
        <aside className="panel filters">
          <div className="panel-head"><h2>Property filters</h2><button className="text-button" onClick={() => { setDraft(defaultFilters); setFilters(defaultFilters); }}>Reset</button></div>
          <div className="filter-section">
            <div className="field">
              <label htmlFor="property-search">Address or geography</label>
              <input id="property-search" value={draft.search} placeholder="Address, city, county, ZIP" onChange={(event) => setDraft({ ...draft, search: event.target.value })} />
            </div>
            {filters.tractGeoid ? <div className="method-note">Filtered to Census tract {filters.tractGeoid}. <button className="text-button" onClick={() => { setDraft({ ...draft, tractGeoid: "" }); setFilters({ ...filters, tractGeoid: "" }); setPage(1); }}>Clear tract</button></div> : null}
            <div className="field">
              <label htmlFor="property-market">Market</label>
              <select id="property-market" value={draft.city} onChange={(event) => setDraft({ ...draft, city: event.target.value })}>
                <option value="">All markets</option>
                {markets.map((market) => <option value={market.city} key={market.city}>{market.city}, {market.stateAbbr}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="property-type">Property type</label>
              <select id="property-type" value={draft.propertyType} onChange={(event) => setDraft({ ...draft, propertyType: event.target.value })}>
                <option value="">All types</option>
                {PROPERTY_TYPES.map((type) => <option value={type} key={type}>{type.replaceAll("-", " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="filter-section">
            <Range label="Maximum asking price" min={50_000} max={10_000_000} step={50_000} value={draft.maximumPrice} output={formatCurrency(draft.maximumPrice)} onChange={(value) => setDraft({ ...draft, maximumPrice: value })} />
            <Range label="Minimum gross yield" min={0} max={0.15} step={0.005} value={draft.minimumGrossYield} output={formatPercent(draft.minimumGrossYield)} onChange={(value) => setDraft({ ...draft, minimumGrossYield: value })} />
            <Range label="Minimum completeness" min={0} max={1} step={0.1} value={draft.minimumCompleteness} output={formatPercent(draft.minimumCompleteness)} onChange={(value) => setDraft({ ...draft, minimumCompleteness: value })} />
          </div>
          <div className="filter-section">
            <button className="button primary" style={{ width: "100%" }} onClick={() => { setLoading(true); setPage(1); setFilters(draft); }}>
              Apply {activeCount ? `${activeCount} filters` : "filters"}
            </button>
          </div>
        </aside>
        <section className="panel results">
          <div className="results-toolbar">
            <div className="result-count">{loading ? "Loading..." : `${payload?.total ?? 0} properties`}</div>
            <div className="toolbar-spacer" />
            <button className="button" onClick={() => setShowSaveSearch((value) => !value)}>
              {showSaveSearch ? "Cancel save" : "Save search"}
            </button>
            <button className="button" onClick={openListingIntake}>Analyze a listing you found</button>
            <button className="button" onClick={() => { setImportMode("csv"); setShowImport((value) => !value); }}>{showImport && importMode === "csv" ? "Close import" : "Import property data"}</button>
            <Link className="button" href="/api/properties/export">Export CSV</Link>
            <div className="segmented">
              <button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}>Cards</button>
              <button className={view === "map" ? "active" : ""} onClick={() => setView("map")}>Map</button>
            </div>
          </div>
          {showSaveSearch ? (
            <div className="save-search-panel">
              <div className="field">
                <label htmlFor="saved-property-search-name">Search name</label>
                <input
                  id="saved-property-search-name"
                  value={searchName}
                  placeholder="e.g. High-yield multifamily under $1M"
                  onChange={(event) => setSearchName(event.target.value)}
                />
              </div>
              <button className="button primary" disabled={!searchName.trim()} onClick={() => void saveSearch()}>
                Save and monitor
              </button>
            </div>
          ) : null}
          {saveMessage ? <p className="status-message" role="status">{saveMessage}</p> : null}
          {showImport ? <ImportPanel key={importMode} defaultMode={importMode} initialFilters={filters} markets={markets} onImported={() => { setRefresh((value) => value + 1); setShowImport(false); }} /> : null}
          {loadError ? <div className="method-note" role="alert">{loadError}</div> : null}
          {!loading && !loadError && !hasProperties ? (
            <div className="property-empty">
              <p className="eyebrow">Ready for authorized data</p>
              <h2>No property records match this workspace</h2>
              <p>
                {filters.city ? `No authorized listing or owner-submitted record is loaded for ${filters.city}. ` : ""}
                Import an authorized CSV or enter a property manually. The system will not fabricate a listing or silently obtain one from a restricted site.
              </p>
              <div className="actions">
                <button className="button primary" onClick={openListingIntake}>Analyze a listing you found</button>
                <Link className="button" href="/api/properties/template">Download CSV template</Link>
              </div>
            </div>
          ) : null}
          {view === "map" && hasProperties ? (
            <PropertyMap properties={payload?.mapItems ?? []} selectedId={selected?.id ?? null} onSelect={setSelected} />
          ) : null}
          {view === "cards" && hasProperties ? (
            <div className="property-card-grid">
              {payload?.items.map((property) => (
                <PropertyCard property={property} selected={selected?.id === property.id} onSelect={setSelected} key={property.id} />
              ))}
            </div>
          ) : null}
          <div className="pagination">
            <span>Page {payload?.page ?? page} of {payload?.pageCount ?? 1}</span>
            <div className="pagination-controls">
              <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
              <button disabled={page >= (payload?.pageCount ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        </section>
      </div>
      {selected ? (
        <aside className="drawer">
          <button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close">x</button>
          <p className="eyebrow">{selected.propertyType.replaceAll("-", " ")}</p>
          <h2>{selected.address}</h2>
          <p className="drawer-lead">{selected.city}, {selected.state} {selected.postalCode}</p>
          <div className="score-hero">
            <span className="score">{selected.derived.favorabilityScore?.toFixed(0) ?? "N/A"}</span>
            <div><strong>{selected.derived.favorabilityStatus}</strong><span>{selected.derived.confidence} confidence | {formatPercent(selected.derived.dataCompleteness)} complete</span></div>
          </div>
          <div className="metric-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            <Metric label="Asking price" value={formatCurrency(selected.askingPrice)} />
            <Metric label="Gross yield" value={formatPercent(selected.derived.grossYield)} />
            <Metric label="Price / sq. ft." value={formatCurrency(selected.derived.pricePerSquareFoot)} />
            <Metric label="Market rent" value={formatCurrency(selected.marketMonthlyRent)} />
          </div>
          <a className="button primary" href={`/properties/${selected.id}`} style={{ marginTop: 18 }}>Open property profile</a>
          <div className="method-note">{selected.derived.disclaimer}</div>
        </aside>
      ) : null}
    </>
  );
}

function ImportPanel({
  defaultMode,
  initialFilters,
  markets,
  onImported,
}: {
  defaultMode: "csv" | "manual";
  initialFilters: Filters;
  markets: Array<{ city: string; stateAbbr: string }>;
  onImported: () => void;
}) {
  const [mode, setMode] = useState<"csv" | "manual">(defaultMode);
  const [sourceName, setSourceName] = useState(defaultMode === "manual" ? "User-supplied listing" : "");
  const [sourceLicense, setSourceLicense] = useState(defaultMode === "manual" ? "User-entered facts; verify against the original source." : "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [filename, setFilename] = useState("");
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState({
    source_record_id: "", address: "", city: initialFilters.city, county: "", state: markets.find((market) => market.city === initialFilters.city)?.stateAbbr ?? "", postal_code: "",
    property_type: "single-family", asking_price: "", market_monthly_rent: "",
    latitude: "", longitude: "", tract_geoid: initialFilters.tractGeoid, observed_at: new Date().toISOString().slice(0, 10),
  });

  async function submit() {
    setMessage("");
    const importRows = mode === "csv" ? rows : [{
      ...manual,
      source_record_id: manual.source_record_id || sourceUrl,
    }];
    const response = await fetch("/api/properties/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: mode === "csv" ? filename : "manual-entry",
        sourceName,
        sourceLicense,
        sourceUrl,
        rows: importRows,
      }),
    });
    const payload = (await response.json()) as { accepted?: number; rejected?: number; error?: string; rejections?: Array<{ row: number; reason: string }> };
    if (!response.ok) {
      setMessage(payload.error ?? "Import failed.");
      return;
    }
    if (!payload.accepted) {
      setMessage(payload.rejections?.map((item) => `Row ${item.row}: ${item.reason}`).join(" ") ?? "No rows were accepted.");
      return;
    }
    setMessage(`${payload.accepted} record(s) accepted; ${payload.rejected ?? 0} rejected.`);
    onImported();
  }

  const hasManualReference = Boolean(manual.source_record_id || sourceUrl);

  return (
    <div className="import-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Source-controlled ingestion</p>
          <h2>{mode === "manual" ? "Analyze a listing you found" : "Import properties"}</h2>
        </div>
        <div className="segmented">
          <button className={mode === "csv" ? "active" : ""} onClick={() => setMode("csv")}>CSV</button>
          <button className={mode === "manual" ? "active" : ""} onClick={() => setMode("manual")}>Manual</button>
        </div>
      </div>
      <div className="import-grid">
        {mode === "manual" ? (
          <div className="field"><label>Original listing URL (recommended)</label><input type="url" value={sourceUrl} placeholder="Paste the listing page you found" onChange={(event) => setSourceUrl(event.target.value)} /></div>
        ) : (
          <>
            <div className="field"><label>Source name</label><input value={sourceName} placeholder="Broker feed, public record, or owner research" onChange={(event) => setSourceName(event.target.value)} /></div>
            <div className="field"><label>License / permission basis</label><input value={sourceLicense} placeholder="Internal authorized use, public domain, contract..." onChange={(event) => setSourceLicense(event.target.value)} /></div>
            <div className="field"><label>Source URL (optional)</label><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></div>
          </>
        )}
      </div>
      {mode === "csv" ? (
        <div className="import-drop">
          <input
            aria-label="Property CSV file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setFilename(file.name);
              void file.text()
                .then((text) => {
                  const parsed = parseCsv(text);
                  setRows(parsed);
                  setMessage(`${file.name}: ${parsed.length} row(s) parsed locally.`);
                })
                .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "CSV parsing failed."));
            }}
          />
          <p>{rows.length ? `${rows.length} row(s) ready for validated import.` : "Choose a CSV using the published contract."}</p>
          <Link className="text-button" href="/api/properties/template">Download blank template</Link>
        </div>
      ) : (
        <div className="manual-grid">
          {Object.entries(manual).map(([key, value]) =>
            key === "property_type" ? (
              <div className="field" key={key}><label>{key.replaceAll("_", " ")}</label><select value={value} onChange={(event) => setManual({ ...manual, [key]: event.target.value })}>{PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
            ) : (
              <div className="field" key={key}><label>{key.replaceAll("_", " ")}</label><input value={value} onChange={(event) => setManual({ ...manual, [key]: event.target.value })} /></div>
            ),
          )}
        </div>
      )}
      <div className="method-note">
        {mode === "manual"
          ? "Enter an address, city, state, asking price, and either the original URL or your own listing reference. The original link is retained as evidence; NII does not scrape or infer listing facts."
          : "By importing, you attest that this workspace is authorized to use the records under the stated permission basis. Raw source files are not redistributed."}
      </div>
      <button className="button primary" disabled={!sourceName || !sourceLicense || (mode === "csv" && !rows.length) || (mode === "manual" && !hasManualReference)} onClick={() => void submit()}>Validate and import</button>
      {message ? <p className="status-message" role="status">{message}</p> : null}
    </div>
  );
}

function PropertyCard({ property, selected, onSelect }: { property: PropertyWithDerived; selected: boolean; onSelect: (property: PropertyWithDerived) => void }) {
  return (
    <article
      aria-label={`View ${property.address}`}
      className={`property-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect(property)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(property);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="property-card-visual">
        <span>{property.propertyType.replaceAll("-", " ")}</span>
        <strong aria-hidden="true">{property.city.slice(0, 2).toUpperCase()}</strong>
      </div>
      <div className="property-card-top"><span className="quality">{property.listingStatus}</span><span>{property.derived.confidence} confidence</span></div>
      <h3>{property.address}</h3>
      <p>{property.city}, {property.state} {property.postalCode}</p>
      <strong className="property-price">{formatCurrency(property.askingPrice)}</strong>
      <div className="property-card-metrics">
        <span>{property.unitCount} unit(s)</span><span>{property.bedrooms ?? "-"} bd</span><span>{property.buildingSquareFeet ?? "-"} sq. ft.</span>
      </div>
      <div className="signal-line"><strong>{property.derived.favorabilityStatus}</strong><span>{formatPercent(property.derived.grossYield)} yield</span></div>
      <small>{property.sourceName} | observed {property.observedAt}</small>
    </article>
  );
}

function Range({ label, min, max, step, value, output, onChange }: { label: string; min: number; max: number; step: number; value: number; output: string; onChange: (value: number) => void }) {
  return <div className="field"><label><span>{label}</span><output>{output}</output></label><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong></div>;
}
