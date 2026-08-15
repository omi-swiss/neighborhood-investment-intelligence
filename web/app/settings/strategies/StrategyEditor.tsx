"use client";

import { useEffect, useMemo, useState } from "react";
import { scoreDefinitions } from "../../lib/area-shared";
import type { StrategyDefinition, StrategyWeights } from "../../lib/types";

const initialWeights: StrategyWeights = {
  demographicMomentum: 0.15,
  incomeMomentum: 0.2,
  rentalStrength: 0.25,
  housingDemand: 0.15,
  riskResilience: 0.15,
  dataReliability: 0.1,
};

export function StrategyEditor() {
  const [items, setItems] = useState<StrategyDefinition[]>([]);
  const [name, setName] = useState("My investment strategy");
  const [weights, setWeights] = useState(initialWeights);
  const [minimumCoverage, setMinimumCoverage] = useState(0.7);
  const [message, setMessage] = useState("");
  const total = useMemo(
    () => Object.values(weights).reduce((sum, value) => sum + value, 0),
    [weights],
  );

  async function load() {
    const response = await fetch("/api/strategies");
    if (!response.ok) return;
    const payload = (await response.json()) as { items: StrategyDefinition[] };
    setItems(payload.items);
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/strategies")
      .then((response) => response.ok ? response.json() as Promise<{ items: StrategyDefinition[] }> : null)
      .then((payload) => {
        if (!cancelled && payload) setItems(payload.items);
      });
    return () => { cancelled = true; };
  }, []);

  async function save() {
    setMessage("");
    const response = await fetch("/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, weights, minimumCoverage }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "The strategy could not be saved.");
      return;
    }
    setMessage("A new immutable strategy version was saved.");
    await load();
  }

  return (
    <div className="content-grid">
      <section className="detail-card">
        <h2>Create a strategy version</h2>
        <div className="field">
          <label htmlFor="strategy-name">Strategy name</label>
          <input id="strategy-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        </div>
        {scoreDefinitions.map((definition) => (
          <div className="field" key={definition.key}>
            <label>
              <span>{definition.label}</span>
              <output>{Math.round(weights[definition.key] * 100)}%</output>
            </label>
            <input
              aria-label={`${definition.label} weight`}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={weights[definition.key]}
              onChange={(event) =>
                setWeights({ ...weights, [definition.key]: Number(event.target.value) })
              }
            />
          </div>
        ))}
        <div className="field">
          <label><span>Minimum data coverage</span><output>{Math.round(minimumCoverage * 100)}%</output></label>
          <input type="range" min="0" max="1" step="0.05" value={minimumCoverage} onChange={(event) => setMinimumCoverage(Number(event.target.value))} />
        </div>
        <p className="drawer-lead">
          Entered weights total {Math.round(total * 100)}%. They are normalized to 100% when saved.
        </p>
        <button className="button primary" onClick={() => void save()}>Save new version</button>
        {message ? <p className="status-message" role="status">{message}</p> : null}
      </section>
      <section className="detail-card">
        <h2>Available versions</h2>
        {items.map((strategy) => (
          <div className="source-item" key={strategy.key}>
            <strong>{strategy.name} v{strategy.version} <span className="quality">{strategy.owner}</span></strong>
            <span>
              {scoreDefinitions.map((definition) =>
                `${definition.label}: ${Math.round(strategy.weights[definition.key] * 100)}%`,
              ).join(" | ")}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
