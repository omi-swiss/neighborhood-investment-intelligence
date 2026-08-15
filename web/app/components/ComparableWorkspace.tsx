"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  defaultComparableFilters,
  type ComparableAnalysis,
  type ComparableCandidate,
  type ComparableFilters,
  type ComparableType,
} from "../lib/comparables";
import { parseCsv } from "../lib/csv";

function money(value: number | null) {
  return value === null
    ? "N/A"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
}

function percent(value: number | null) {
  return value === null
    ? "N/A"
    : new Intl.NumberFormat("en-US", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
}

function queryFor(type: ComparableType, filters: ComparableFilters) {
  return new URLSearchParams({
    type,
    radiusMiles: String(filters.radiusMiles),
    sameTractOnly: String(filters.sameTractOnly),
    samePropertyType: String(filters.samePropertyType),
    maximumUnitDifference: String(filters.maximumUnitDifference),
    sizeTolerance: String(filters.sizeTolerance),
    ageToleranceYears: String(filters.ageToleranceYears),
    maximumAgeMonths: String(filters.maximumAgeMonths),
  });
}

export function ComparableWorkspace({ propertyId }: { propertyId: number }) {
  const [type, setType] = useState<ComparableType>("sale");
  const [filters, setFilters] = useState<ComparableFilters>(defaultComparableFilters);
  const [analysis, setAnalysis] = useState<ComparableAnalysis | null>(null);
  const [status, setStatus] = useState("Loading comparable evidence...");
  const [refresh, setRefresh] = useState(0);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/properties/${propertyId}/comparables?${queryFor(type, filters)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Comparable evidence could not be loaded.");
        return response.json() as Promise<{ analysis: ComparableAnalysis }>;
      })
      .then((payload) => {
        if (!cancelled) {
          setAnalysis(payload.analysis);
          setStatus("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : "Comparable evidence could not be loaded.");
        }
      });
    return () => { cancelled = true; };
  }, [filters, propertyId, refresh, type]);

  async function saveDecision(
    candidate: ComparableCandidate,
    decision: "automatic" | "include" | "exclude",
    adjustmentPercent = candidate.adjustmentPercent,
    adjustmentNotes = candidate.adjustmentNotes ?? "",
  ) {
    const response = await fetch(`/api/properties/${propertyId}/comparables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        comparableRecordId: candidate.id,
        decision,
        adjustmentPercent,
        adjustmentNotes,
      }),
    });
    setStatus(response.ok ? "Comparable decision saved." : "Comparable decision could not be saved.");
    if (response.ok) setRefresh((value) => value + 1);
  }

  return (
    <section className="detail-card wide-card comparable-workspace">
      <div className="comparable-heading">
        <div>
          <p className="eyebrow">Authorized evidence only</p>
          <h2>Comparable-property analysis</h2>
          <p className="drawer-lead">
            Closed-sale and rental records remain separate. Automated matching is transparent,
            and every inclusion, exclusion, or adjustment is saved for this subject property.
          </p>
        </div>
        <div className="actions">
          <button className="button" onClick={() => setShowImport((value) => !value)}>
            {showImport ? "Close import" : "Import comparables"}
          </button>
          <Link className="button" href="/api/comparables/template">CSV template</Link>
        </div>
      </div>
      {showImport ? (
        <ComparableImport
          onImported={() => {
            setRefresh((value) => value + 1);
          }}
        />
      ) : null}
      <div className="comparable-controls">
        <div className="segmented">
          <button className={type === "sale" ? "active" : ""} onClick={() => setType("sale")}>
            Sales
          </button>
          <button className={type === "rental" ? "active" : ""} onClick={() => setType("rental")}>
            Rentals
          </button>
        </div>
        <FilterNumber
          label="Radius (miles)"
          value={filters.radiusMiles}
          step={0.5}
          onChange={(radiusMiles) => setFilters({ ...filters, radiusMiles })}
        />
        <FilterNumber
          label="Max age (months)"
          value={filters.maximumAgeMonths}
          step={1}
          onChange={(maximumAgeMonths) => setFilters({ ...filters, maximumAgeMonths })}
        />
        <FilterNumber
          label="Size tolerance"
          value={filters.sizeTolerance * 100}
          step={5}
          suffix="%"
          onChange={(value) => setFilters({ ...filters, sizeTolerance: value / 100 })}
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={filters.samePropertyType}
            onChange={(event) => setFilters({ ...filters, samePropertyType: event.target.checked })}
          />
          Same property type
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={filters.sameTractOnly}
            onChange={(event) => setFilters({ ...filters, sameTractOnly: event.target.checked })}
          />
          Same tract only
        </label>
      </div>
      {status ? <p className="status-message" role="status">{status}</p> : null}
      {analysis ? (
        <>
          <div className="return-grid comparable-summary">
            <Summary label={type === "sale" ? "Estimated value" : "Estimated rent"} value={money(analysis.estimate)} />
            <Summary label="Comparable range" value={`${money(analysis.rangeLow)}–${money(analysis.rangeHigh)}`} />
            <Summary label={type === "sale" ? "Subject premium / discount" : "Subject rent premium"} value={percent(analysis.discountPremium)} />
            <Summary label="Confidence" value={analysis.confidence} />
            <Summary label="Relative pricing signal" value={analysis.relativePricingStatus} />
          </div>
          <div className="source-item comparable-signal-audit">
            <strong>Comparable-relative pricing component</strong>
            <span>
              Input: subject {type === "sale" ? "asking price" : "rent"} versus median adjusted
              comparable estimate | Benchmark: ±3% neutral band | Favorable direction: {type === "sale" ? "lower subject price" : "higher supported subject rent"} | Confidence: {analysis.confidence} | Source: included
              authorized {type} records | Missing-data effect: unavailable when no comparable
              estimate can be calculated
            </span>
          </div>
          {analysis.warnings.map((warning) => <div className="method-note" key={warning}>{warning}</div>)}
          {!analysis.candidates.length ? (
            <div className="property-empty compact-empty">
              <h2>No authorized {type} comparable records</h2>
              <p>
                Import closed-sale records with sale prices or rental records with monthly rents.
                Active listings are not silently treated as transactions.
              </p>
              <button className="button primary" onClick={() => setShowImport(true)}>Import comparable evidence</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="comparison-table comparable-table">
                <thead>
                  <tr>
                    <th>Comparable</th><th>Date</th><th>Observed</th><th>Adjusted</th>
                    <th>Distance</th><th>Match</th><th>Decision and adjustment</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.candidates.slice(0, 100).map((candidate) => (
                    <ComparableRow
                      candidate={candidate}
                      type={type}
                      onSave={saveDecision}
                      key={candidate.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="method-note">
            {analysis.methodology} The range is descriptive dispersion, not an appraisal confidence
            interval. Verify transaction terms, concessions, condition, and source rights.
          </div>
        </>
      ) : null}
    </section>
  );
}

function ComparableRow({
  candidate,
  type,
  onSave,
}: {
  candidate: ComparableCandidate;
  type: ComparableType;
  onSave: (
    candidate: ComparableCandidate,
    decision: "automatic" | "include" | "exclude",
    adjustmentPercent?: number,
    adjustmentNotes?: string,
  ) => Promise<void>;
}) {
  const [adjustment, setAdjustment] = useState(candidate.adjustmentPercent * 100);
  const [notes, setNotes] = useState(candidate.adjustmentNotes ?? "");
  const observed = type === "sale" ? candidate.salePrice : candidate.monthlyRent;
  return (
    <tr className={candidate.included ? "" : "comparable-excluded"}>
      <td>
        <strong>{candidate.address}</strong>
        <small>
          {candidate.propertyType.replaceAll("-", " ")} | {candidate.unitCount} unit(s)
          {candidate.buildingSquareFeet ? ` | ${candidate.buildingSquareFeet} sq. ft.` : ""}
        </small>
        <small>{candidate.sourceName} | {candidate.matchReasons.join(" | ")}</small>
      </td>
      <td>{candidate.transactionDate}</td>
      <td>{money(observed)}</td>
      <td>{money(candidate.adjustedValue)}<small>{candidate.adjustmentBasis}</small></td>
      <td>{candidate.distanceMiles === null ? "N/A" : `${candidate.distanceMiles.toFixed(2)} mi`}</td>
      <td>{percent(candidate.matchScore)}</td>
      <td>
        <div className="comp-decision">
          <select
            aria-label={`Decision for ${candidate.address}`}
            value={candidate.decision}
            onChange={(event) => void onSave(
              candidate,
              event.target.value as "automatic" | "include" | "exclude",
              adjustment / 100,
              notes,
            )}
          >
            <option value="automatic">Automatic</option>
            <option value="include">Include</option>
            <option value="exclude">Exclude</option>
          </select>
          <label>
            Adjustment %
            <input
              type="number"
              min="-50"
              max="100"
              step="1"
              value={adjustment}
              onChange={(event) => setAdjustment(Number(event.target.value))}
            />
          </label>
          <input
            aria-label={`Adjustment notes for ${candidate.address}`}
            value={notes}
            maxLength={500}
            placeholder="Adjustment notes"
            onChange={(event) => setNotes(event.target.value)}
          />
          <button
            className="text-button"
            onClick={() => void onSave(candidate, candidate.decision, adjustment / 100, notes)}
          >
            Save adjustment
          </button>
        </div>
      </td>
    </tr>
  );
}

function ComparableImport({ onImported }: { onImported: () => void }) {
  const [sourceName, setSourceName] = useState("");
  const [sourceLicense, setSourceLicense] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [message, setMessage] = useState("");
  const acceptedTypes = useMemo(
    () => [...new Set(rows.map((row) => row.comparable_type).filter(Boolean))].join(", "),
    [rows],
  );

  async function submit() {
    const response = await fetch("/api/comparables/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceName, sourceLicense, sourceUrl, rows }),
    });
    const payload = (await response.json()) as {
      accepted?: number;
      rejected?: number;
      error?: string;
      rejections?: Array<{ row: number; reason: string }>;
    };
    if (!response.ok || !payload.accepted) {
      setMessage(
        payload.error ??
        payload.rejections?.map((item) => `Row ${item.row}: ${item.reason}`).join(" ") ??
        "No comparable rows were accepted.",
      );
      return;
    }
    setMessage(`${payload.accepted} comparable record(s) accepted; ${payload.rejected ?? 0} rejected.`);
    onImported();
  }

  return (
    <div className="import-panel comparable-import">
      <div className="import-grid">
        <div className="field"><label>Source name</label><input value={sourceName} onChange={(event) => setSourceName(event.target.value)} /></div>
        <div className="field"><label>License / permission basis</label><input value={sourceLicense} onChange={(event) => setSourceLicense(event.target.value)} /></div>
        <div className="field"><label>Source URL (optional)</label><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></div>
      </div>
      <div className="import-drop">
        <input
          aria-label="Comparable CSV file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void file.text().then((text) => {
              const parsed = parseCsv(text);
              setRows(parsed);
              setMessage(`${parsed.length} row(s) parsed locally.`);
            });
          }}
        />
        <p>{rows.length ? `${rows.length} row(s) ready | types: ${acceptedTypes || "not provided"}` : "Choose the comparable CSV template."}</p>
      </div>
      <div className="method-note">
        Sale rows require a closed sale price. Rental rows require a monthly rent. Importing attests
        that this private workspace is authorized to use the source.
      </div>
      <button className="button primary" disabled={!sourceName || !sourceLicense || !rows.length} onClick={() => void submit()}>
        Validate and import
      </button>
      {message ? <p className="status-message" role="status">{message}</p> : null}
    </div>
  );
}

function FilterNumber({
  label,
  value,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="compact-number">
      <span>{label}</span>
      <span><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />{suffix}</span>
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong></div>;
}
