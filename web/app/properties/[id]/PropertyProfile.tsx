"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PropertyWithDerived } from "../../lib/property-domain";
import { PropertyMap } from "../../components/PropertyMap";
import { ComparableWorkspace } from "../../components/ComparableWorkspace";
import { WatchEntityButton } from "../../components/WatchEntityButton";
import { appendContext } from "../../lib/investor-context";

type ListingHistory = {
  id: number;
  askingPrice: number;
  listingStatus: string;
  observedAt: string;
};

function currency(value: number | null) {
  return value === null
    ? "Not available"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function percent(value: number | null) {
  return value === null
    ? "Not available"
    : new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

export function PropertyProfile({ propertyId, returnTo }: { propertyId: string; returnTo?: string }) {
  const [property, setProperty] = useState<PropertyWithDerived | null>(null);
  const [history, setHistory] = useState<ListingHistory[]>([]);
  const [status, setStatus] = useState("Loading property evidence...");
  const [saveMessage, setSaveMessage] = useState("");
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/properties/${propertyId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 404 ? "Property not found in your private workspace." : "Property evidence could not be loaded.");
        return response.json() as Promise<{ item: PropertyWithDerived; history: ListingHistory[] }>;
      })
      .then((payload) => {
        if (!cancelled) {
          setProperty(payload.item);
          setHistory(payload.history);
          setStatus("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatus(error instanceof Error ? error.message : "Property evidence could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [propertyId]);

  async function save() {
    const response = await fetch("/api/saved-properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId: property?.id }),
    });
    setSaveMessage(response.ok ? "Property saved to your private workspace." : "Property could not be saved.");
  }

  if (!property) return <section className="detail-card"><p role="status">{status}</p></section>;
  return (
    <>
      <div className="detail-profile-head">
        <div>
          <p className="eyebrow">{property.propertyType.replaceAll("-", " ")} | {property.listingStatus}</p>
          <h2>{property.address}</h2>
          <p className="detail-context">{property.city}, {property.county ? `${property.county}, ` : ""}{property.state} {property.postalCode}</p>
        </div>
        <div className="actions">
          <Link className="button primary" href={appendContext("/underwriting", { version: 1, propertyId: property.id, tractGeoid: property.tractGeoid ?? undefined, sourceRecordId: property.sourceRecordId, returnTo: `/properties/${property.id}` })}>Open financial model</Link>
          <button className="button primary" onClick={() => void save()}>Save property</button>
          <WatchEntityButton entityType="property" entityKey={String(property.id)} />
          <Link className="button" href={returnTo ?? "/properties"}>Back to marketplace</Link>
        </div>
      </div>
      {saveMessage ? <p className="status-message">{saveMessage}</p> : null}
      <div className="detail-grid">
        <section className="detail-card">
          <h2>Overview</h2>
          <div className="metric-grid">
            <Metric label="Asking price" value={currency(property.askingPrice)} note="Imported observation" />
            <Metric label="Market rent" value={currency(property.marketMonthlyRent)} note="Imported estimate" />
            <Metric label="Gross yield" value={percent(property.derived.grossYield)} note="Rent x 12 / asking price" />
            <Metric label="Cap-rate proxy" value={percent(property.derived.capRateProxy)} note="Incomplete operating proxy" />
            <Metric label="Price / sq. ft." value={currency(property.derived.pricePerSquareFoot)} note="Asking price / building area" />
            <Metric label="Completeness" value={percent(property.derived.dataCompleteness)} note={`${property.derived.confidence} confidence`} />
          </div>
        </section>
        <section className="detail-card">
          <h2>Basic favorability signal</h2>
          <div className="score-hero">
            <span className="score">{property.derived.favorabilityScore?.toFixed(0) ?? "N/A"}</span>
            <div><strong>{property.derived.favorabilityStatus}</strong><span>{property.derived.confidence} confidence</span></div>
          </div>
          {property.derived.components.map((component) => (
            <div className="score-row property-score-row" key={component.key}>
              <div><strong>{component.label}</strong><span className="metric-sub">{component.value} | {component.direction}</span></div>
              <strong>{component.score?.toFixed(0) ?? "N/A"}</strong>
              <div className="score-bar"><span style={{ width: `${component.score ?? 0}%` }} /></div>
              <small>{Math.round(component.weight * 100)}% weight | {component.benchmark} | {component.missingEffect}</small>
            </div>
          ))}
          <div className="method-note">{property.derived.disclaimer}</div>
        </section>
        <section className="detail-card">
          <h2>Property information</h2>
          <div className="source-list">
            <Fact label="Units" value={String(property.unitCount)} />
            <Fact label="Bedrooms / bathrooms" value={`${property.bedrooms ?? "Not available"} / ${property.bathrooms ?? "Not available"}`} />
            <Fact label="Building / lot area" value={`${property.buildingSquareFeet ?? "Not available"} / ${property.lotSquareFeet ?? "Not available"} sq. ft.`} />
            <Fact label="Year built" value={property.yearBuilt?.toString() ?? "Not available"} />
            <Fact label="Parcel ID" value={property.parcelId ?? "Not available"} />
            <Fact label="Listing date" value={property.listingDate ?? "Not available"} />
            <Fact label="Broker" value={property.broker ?? "Not available"} />
          </div>
        </section>
        <section className="detail-card">
          <h2>Operating-input snapshot</h2>
          <div className="source-list">
            <Fact label="Current monthly rent" value={currency(property.currentMonthlyRent)} />
            <Fact label="Annual property taxes" value={currency(property.annualPropertyTaxes)} />
            <Fact label="Annual insurance" value={currency(property.annualInsurance)} />
            <Fact label="Monthly HOA" value={currency(property.hoaMonthly)} />
            <Fact label="Monthly maintenance" value={currency(property.maintenanceMonthly)} />
            <Fact label="Vacancy assumption" value={percent(property.vacancyAssumption)} />
            <Fact label="Renovation estimate" value={currency(property.renovationEstimate)} />
          </div>
          <div className="method-note">Debt, closing costs, capital expenditures, management, utilities, and financing are not silently assumed here. Open the financial model to review every input and scenario.</div>
        </section>
        <section className="detail-card">
          <h2>Neighborhood context</h2>
          {property.tractGeoid ? (
            <p className="drawer-lead">Linked census tract: <a href={`/areas/${property.tractGeoid}`}>{property.tractGeoid}</a>. The favorability signal uses its balanced opportunity percentile when supported.</p>
          ) : (
            <p className="drawer-lead">No census tract was supplied. Neighborhood context remains unavailable rather than being geocoded or inferred without a validated service.</p>
          )}
          {property.latitude !== null && property.longitude !== null ? (
            <PropertyMap properties={[property]} selectedId={property.id} onSelect={() => undefined} />
          ) : null}
        </section>
        <section className="detail-card">
          <h2>Listing observation history</h2>
          {!history.length ? (
            <p className="drawer-lead">No historical observations were captured before this release. Re-imports with a distinct observation date will appear here.</p>
          ) : (
            <div className="table-wrap">
              <table className="comparison-table">
                <thead><tr><th>Observed</th><th>Asking price</th><th>Status</th></tr></thead>
                <tbody>
                  {history.map((observation) => (
                    <tr key={observation.id}>
                      <td>{new Date(observation.observedAt).toLocaleDateString()}</td>
                      <td>{currency(observation.askingPrice)}</td>
                      <td>{observation.listingStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <ComparableWorkspace propertyId={property.id} />
      </div>
    </>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric-tile"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="source-item"><strong>{label}</strong><span>{value}</span></div>;
}
