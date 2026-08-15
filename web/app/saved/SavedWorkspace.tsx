"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatPercent } from "../lib/area-shared";
import { filtersToSearch } from "../lib/screener-query";
import type { AreaRecord, ScreenerFilters } from "../lib/types";
import type { PropertyWithDerived } from "../lib/property-domain";

type SavedArea = { id: number; areaId: string; createdAt: string; area: AreaRecord };
type SavedFilter = { id: number; name: string; createdAt: string; query: ScreenerFilters };
type SavedProperty = { id: number; propertyId: number; createdAt: string; property: PropertyWithDerived };
type SavedModel = {
  id: number;
  propertyId: number | null;
  name: string;
  latestVersion: number;
  updatedAt: string;
};

export function SavedWorkspace() {
  const [areas, setAreas] = useState<SavedArea[]>([]);
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [properties, setProperties] = useState<SavedProperty[]>([]);
  const [models, setModels] = useState<SavedModel[]>([]);
  const [status, setStatus] = useState("Loading your private workspace...");

  async function load() {
    const [areaResponse, filterResponse, propertyResponse, modelResponse] = await Promise.all([
      fetch("/api/saved-areas"),
      fetch("/api/saved-filter-sets"),
      fetch("/api/saved-properties"),
      fetch("/api/financial-models"),
    ]);
    if ([areaResponse, filterResponse, propertyResponse, modelResponse].some((response) => response.status === 401)) {
      setStatus("Sign in through the private site to use saved work.");
      return;
    }
    if ([areaResponse, filterResponse, propertyResponse, modelResponse].some((response) => !response.ok)) {
      setStatus("Saved work could not be loaded.");
      return;
    }
    const areaPayload = (await areaResponse.json()) as { items: SavedArea[] };
    const filterPayload = (await filterResponse.json()) as { items: SavedFilter[] };
    const propertyPayload = (await propertyResponse.json()) as { items: SavedProperty[] };
    const modelPayload = (await modelResponse.json()) as { items: SavedModel[] };
    setAreas(areaPayload.items);
    setFilters(filterPayload.items);
    setProperties(propertyPayload.items);
    setModels(modelPayload.items);
    setStatus("");
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/saved-areas"),
      fetch("/api/saved-filter-sets"),
      fetch("/api/saved-properties"),
      fetch("/api/financial-models"),
    ])
      .then(async ([areaResponse, filterResponse, propertyResponse, modelResponse]) => {
        if (cancelled) return;
        if ([areaResponse, filterResponse, propertyResponse, modelResponse].some((response) => response.status === 401)) {
          setStatus("Sign in through the private site to use saved work.");
          return;
        }
        if ([areaResponse, filterResponse, propertyResponse, modelResponse].some((response) => !response.ok)) {
          setStatus("Saved work could not be loaded.");
          return;
        }
        const areaPayload = (await areaResponse.json()) as { items: SavedArea[] };
        const filterPayload = (await filterResponse.json()) as { items: SavedFilter[] };
        const propertyPayload = (await propertyResponse.json()) as { items: SavedProperty[] };
        const modelPayload = (await modelResponse.json()) as { items: SavedModel[] };
        if (!cancelled) {
          setAreas(areaPayload.items);
          setFilters(filterPayload.items);
          setProperties(propertyPayload.items);
          setModels(modelPayload.items);
          setStatus("");
        }
      });
    return () => { cancelled = true; };
  }, []);

  async function removeArea(areaId: string) {
    await fetch(`/api/saved-areas?areaId=${encodeURIComponent(areaId)}`, { method: "DELETE" });
    await load();
  }

  async function removeFilter(id: number) {
    await fetch(`/api/saved-filter-sets?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function removeProperty(propertyId: number) {
    await fetch(`/api/saved-properties?propertyId=${propertyId}`, { method: "DELETE" });
    await load();
  }

  async function removeModel(id: number) {
    await fetch(`/api/financial-models?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="content-grid">
      {status ? <p className="status-message" role="status">{status}</p> : null}
      <section className="detail-card">
        <h2>Saved areas</h2>
        {!areas.length && !status ? <p className="drawer-lead">No saved areas yet.</p> : null}
        {areas.map(({ area }) => (
          <div className="saved-row" key={area.id}>
            <div>
              <a href={`/areas/${area.id}`}><strong>{area.name}</strong></a>
              <span>{area.county}, {area.stateAbbr} | {formatCurrency(area.metrics.medianHomeValue)} | {formatPercent(area.metrics.grossYieldProxy)} yield proxy</span>
            </div>
            <button className="text-button" onClick={() => void removeArea(area.id)}>Remove</button>
          </div>
        ))}
      </section>
      <section className="detail-card">
        <h2>Saved properties</h2>
        {!properties.length && !status ? <p className="drawer-lead">No saved properties yet.</p> : null}
        {properties.map(({ property }) => (
          <div className="saved-row" key={property.id}>
            <div>
              <a href={`/properties/${property.id}`}><strong>{property.address}</strong></a>
              <span>{property.city}, {property.state} | {formatCurrency(property.askingPrice)} | {property.derived.favorabilityStatus}</span>
            </div>
            <button className="text-button" onClick={() => void removeProperty(property.id)}>Remove</button>
          </div>
        ))}
      </section>
      <section className="detail-card">
        <h2>Saved financial models</h2>
        {!models.length && !status ? <p className="drawer-lead">No saved financial models yet.</p> : null}
        {models.map((model) => (
          <div className="saved-row" key={model.id}>
            <div>
              <a href={`/underwriting?modelId=${model.id}`}><strong>{model.name}</strong></a>
              <span>
                Version {model.latestVersion} | Updated {new Date(model.updatedAt).toLocaleDateString()}
                {model.propertyId ? ` | Property ${model.propertyId}` : ""}
              </span>
            </div>
            <button className="text-button" onClick={() => void removeModel(model.id)}>Remove</button>
          </div>
        ))}
      </section>
      <section className="detail-card">
        <h2>Saved filter sets</h2>
        {!filters.length && !status ? <p className="drawer-lead">No saved filter sets yet.</p> : null}
        {filters.map((filter) => (
          <div className="saved-row" key={filter.id}>
            <div>
              <a href={`/?${filtersToSearch(filter.query)}`}><strong>{filter.name}</strong></a>
              <span>{filter.query.strategyName} v{filter.query.strategyVersion} | score {filter.query.minimumScore}+</span>
            </div>
            <button className="text-button" onClick={() => void removeFilter(filter.id)}>Remove</button>
          </div>
        ))}
      </section>
    </div>
  );
}
