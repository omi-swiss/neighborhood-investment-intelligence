"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CALCULATION_VERSION,
  applyScenario,
  calculateFinancialModel,
  defaultFinancialAssumptions,
  defaultScenarios,
  normalizeFinancialNumber,
  type FinancialAssumptions,
  type FinancialResults,
  type InputSource,
  type ScenarioDefinition,
} from "../lib/financial-model";
import type { PropertyWithDerived } from "../lib/property-domain";
import { SensitivityPanel } from "./SensitivityPanel";

type NumericKey = {
  [K in keyof FinancialAssumptions]: FinancialAssumptions[K] extends number ? K : never
}[keyof FinancialAssumptions];

const sections: Array<{
  title: string;
  fields: Array<{
    key: NumericKey;
    label: string;
    kind?: "percent" | "signed-percent" | "years" | "months";
  }>;
}> = [
  {
    title: "Acquisition",
    fields: [
      { key: "purchasePrice", label: "Asking / purchase price" },
      { key: "offerPrice", label: "Offer price" },
      { key: "closingCosts", label: "Closing costs" },
      { key: "inspectionLegalCosts", label: "Inspection and legal" },
      { key: "renovationBudget", label: "Renovation budget" },
      { key: "initialReserves", label: "Initial reserves" },
    ],
  },
  {
    title: "Financing",
    fields: [
      { key: "downPaymentPercent", label: "Down payment", kind: "percent" },
      { key: "interestRate", label: "Interest rate", kind: "percent" },
      { key: "loanTermYears", label: "Loan term", kind: "years" },
      { key: "amortizationYears", label: "Amortization", kind: "years" },
      { key: "interestOnlyYears", label: "Interest-only period", kind: "years" },
      { key: "pointsPercent", label: "Points", kind: "percent" },
      { key: "originationFees", label: "Origination fees" },
    ],
  },
  {
    title: "Income",
    fields: [
      { key: "monthlyRent", label: "Monthly rent" },
      { key: "otherMonthlyIncome", label: "Other monthly income" },
      { key: "leaseUpMonths", label: "Year-one lease-up", kind: "months" },
      { key: "rentGrowth", label: "Annual rent growth", kind: "signed-percent" },
      { key: "vacancyRate", label: "Vacancy", kind: "percent" },
      { key: "creditLossRate", label: "Credit loss", kind: "percent" },
    ],
  },
  {
    title: "Operating expenses",
    fields: [
      { key: "propertyTaxRate", label: "Property tax rate", kind: "percent" },
      { key: "annualInsurance", label: "Annual insurance" },
      { key: "hoaMonthly", label: "Monthly HOA / common charges" },
      { key: "utilitiesMonthly", label: "Monthly utilities" },
      { key: "otherAnnualExpenses", label: "Other annual expenses" },
      { key: "managementPercent", label: "Management", kind: "percent" },
      { key: "maintenancePercent", label: "Repairs and maintenance", kind: "percent" },
      { key: "capitalReservePercent", label: "Capital reserves", kind: "percent" },
      { key: "expenseGrowth", label: "Annual expense growth", kind: "percent" },
    ],
  },
  {
    title: "Exit and return assumptions",
    fields: [
      { key: "appreciationRate", label: "Annual appreciation", kind: "signed-percent" },
      { key: "sellingCostRate", label: "Selling costs", kind: "percent" },
      { key: "exitCapRate", label: "Exit cap rate", kind: "percent" },
      { key: "exitValueAdjustment", label: "Exit value adjustment", kind: "signed-percent" },
      { key: "discountRate", label: "NPV discount rate", kind: "percent" },
    ],
  },
];

function money(value: number | null) {
  return value === null ? "N/A" : new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  }).format(value);
}

function percent(value: number | null) {
  return value === null ? "N/A" : new Intl.NumberFormat("en-US", {
    style: "percent", maximumFractionDigits: 1,
  }).format(value);
}

function multiple(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(2)}x`;
}

export function FinancialWorkbench({
  propertyId,
  modelId,
}: {
  propertyId?: string;
  modelId?: string;
}) {
  const [assumptions, setAssumptions] = useState<FinancialAssumptions>({
    ...defaultFinancialAssumptions,
    inputSources: { ...defaultFinancialAssumptions.inputSources },
  });
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>(
    defaultScenarios.map((scenario) => ({ ...scenario, overrides: { ...scenario.overrides } })),
  );
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [mode, setMode] = useState<"quick" | "detailed">("detailed");
  const [quickStep, setQuickStep] = useState(0);
  const [listingLink, setListingLink] = useState("");
  const [message, setMessage] = useState("");
  const [currentModelId, setCurrentModelId] = useState<number | null>(
    modelId && Number.isInteger(Number(modelId)) ? Number(modelId) : null,
  );
  const quickSteps = ["Property", "Loan", "Income", "Expenses", "Review"];
  const quickFieldKeys: NumericKey[][] = [
    ["purchasePrice", "offerPrice", "renovationBudget"],
    ["downPaymentPercent", "interestRate", "amortizationYears"],
    ["monthlyRent", "rentGrowth", "vacancyRate"],
    ["propertyTaxRate", "annualInsurance", "managementPercent", "maintenancePercent"],
    [],
  ];

  async function importListingLink() {
    setMessage("");
    const response = await fetch("/api/properties/link-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: listingLink }),
    });
    const payload = await response.json() as { message?: string; sourceUrl?: string };
    setMessage(payload.message ?? (response.ok ? "Listing link saved as source evidence." : "Listing link could not be accepted."));
  }

  async function estimateTaxes() {
    const response = await fetch("/api/property-tax-estimate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ propertyId: assumptions.propertyId, purchasePrice: assumptions.offerPrice }),
    });
    const payload = await response.json() as { annualTax?: number; message?: string };
    if (response.ok && typeof payload.annualTax === "number") {
      updateNumber("annualPropertyTaxes", payload.annualTax, "property-observed");
      if (assumptions.offerPrice > 0) {
        updateNumber(
          "propertyTaxRate",
          normalizeFinancialNumber(payload.annualTax / assumptions.offerPrice, 6),
          "property-observed",
        );
      }
    }
    setMessage(payload.message ?? "Tax estimate is unavailable.");
  }

  useEffect(() => {
    if (!modelId) return;
    let cancelled = false;
    void fetch(`/api/financial-models/${modelId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved model could not be loaded.");
        return response.json() as Promise<{
          item: {
            id: number;
            version: number;
            assumptions: FinancialAssumptions;
            scenarios: Array<ScenarioDefinition & { results: FinancialResults }>;
          };
        }>;
      })
      .then(({ item }) => {
        if (!cancelled) {
          const saved = item.assumptions as FinancialAssumptions & { propertyTaxRate?: number };
          const derivedTaxRate =
            saved.offerPrice > 0
              ? normalizeFinancialNumber(saved.annualPropertyTaxes / saved.offerPrice, 6)
              : defaultFinancialAssumptions.propertyTaxRate;
          setAssumptions({
            ...defaultFinancialAssumptions,
            ...saved,
            propertyTaxRate: saved.propertyTaxRate ?? derivedTaxRate,
            inputSources: {
              ...defaultFinancialAssumptions.inputSources,
              ...saved.inputSources,
            },
          });
          setScenarios(item.scenarios.map(({ name, type, overrides }) => ({ name, type, overrides })));
          setSelectedScenario(0);
          setCurrentModelId(item.id);
          setMessage(`Loaded saved model version ${item.version}. New saves create a new immutable version.`);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Saved model could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [modelId]);

  useEffect(() => {
    if (!propertyId || modelId) return;
    let cancelled = false;
    void fetch(`/api/properties/${propertyId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Property inputs could not be loaded.");
        return response.json() as Promise<{ item: PropertyWithDerived }>;
      })
      .then(({ item }) => {
        if (cancelled) return;
        const updates: Partial<FinancialAssumptions> = {
          modelName: `${item.address} underwriting`,
          propertyId: item.id,
          purchasePrice: item.askingPrice,
          offerPrice: item.askingPrice,
        };
        const observedKeys = ["purchasePrice", "offerPrice"];
        const observedValues: Array<[NumericKey, number | null]> = [
          ["monthlyRent", item.marketMonthlyRent ?? item.currentMonthlyRent],
          ["annualPropertyTaxes", item.annualPropertyTaxes],
          ["annualInsurance", item.annualInsurance],
          ["hoaMonthly", item.hoaMonthly],
          ["renovationBudget", item.renovationEstimate],
          ["vacancyRate", item.vacancyAssumption],
        ];
        for (const [key, value] of observedValues) {
          if (value !== null) {
            (updates as Record<string, unknown>)[key] = value;
            observedKeys.push(key);
          }
        }
        if (item.annualPropertyTaxes !== null && item.askingPrice > 0) {
          updates.propertyTaxRate = normalizeFinancialNumber(
            item.annualPropertyTaxes / item.askingPrice,
            6,
          );
          observedKeys.push("propertyTaxRate");
        }
        setAssumptions((current) => ({
          ...current,
          ...updates,
          inputSources: {
            ...current.inputSources,
            ...Object.fromEntries(observedKeys.map((key) => [key, "property-observed" as InputSource])),
          },
        }));
        setMessage("Available property facts were loaded. Review the remaining assumptions before saving.");
      })
      .catch((error: unknown) => {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Property inputs could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [propertyId, modelId]);

  useEffect(() => {
    const annualTax = normalizeFinancialNumber(
      assumptions.offerPrice * assumptions.propertyTaxRate,
      2,
    );
    if (annualTax === assumptions.annualPropertyTaxes) return;
    setAssumptions((current) => ({
      ...current,
      annualPropertyTaxes: annualTax,
      inputSources: {
        ...current.inputSources,
        annualPropertyTaxes:
          current.inputSources.propertyTaxRate ?? "system-default",
      },
    }));
  }, [
    assumptions.annualPropertyTaxes,
    assumptions.offerPrice,
    assumptions.propertyTaxRate,
  ]);

  const scenarioResults = useMemo(
    () =>
      scenarios.map((scenario) => {
        try {
          return { scenario, results: calculateFinancialModel(applyScenario(assumptions, scenario)), error: "" };
        } catch (error) {
          return { scenario, results: null, error: error instanceof Error ? error.message : "Calculation failed." };
        }
      }),
    [assumptions, scenarios],
  );
  const active = scenarioResults[selectedScenario] ?? scenarioResults[0];
  const stressResults = useMemo(() => {
    const stressCases: ScenarioDefinition[] = [
      {
        name: "Rate +2.0 pts",
        type: "custom",
        overrides: { interestRate: Math.min(1, assumptions.interestRate + 0.02) },
      },
      {
        name: "Vacancy +5.0 pts",
        type: "custom",
        overrides: { vacancyRate: Math.min(0.9, assumptions.vacancyRate + 0.05) },
      },
      {
        name: "Rent -10%",
        type: "custom",
        overrides: { monthlyRent: assumptions.monthlyRent * 0.9 },
      },
      {
        name: "Taxes +20%",
        type: "custom",
        overrides: { annualPropertyTaxes: assumptions.annualPropertyTaxes * 1.2 },
      },
      {
        name: "Insurance +25%",
        type: "custom",
        overrides: { annualInsurance: assumptions.annualInsurance * 1.25 },
      },
      {
        name: "Renovation overrun",
        type: "custom",
        overrides: {
          renovationBudget:
            assumptions.renovationBudget + Math.max(assumptions.renovationBudget * 0.2, 25_000),
        },
      },
      {
        name: "Lease-up 3 months",
        type: "custom",
        overrides: { leaseUpMonths: Math.max(assumptions.leaseUpMonths, 3) },
      },
      {
        name: "Exit value -10%",
        type: "custom",
        overrides: { exitValueAdjustment: Math.max(-0.99, assumptions.exitValueAdjustment - 0.1) },
      },
      {
        name: "Exit cap +1.0 pt",
        type: "custom",
        overrides: { exitCapRate: Math.min(1, assumptions.exitCapRate + 0.01) },
      },
      {
        name: "Rent growth capped",
        type: "custom",
        overrides: { rentGrowth: Math.min(0, assumptions.rentGrowth) },
      },
    ];
    return stressCases.map((scenario) => {
      try {
        return { scenario, results: calculateFinancialModel(applyScenario(assumptions, scenario)), error: "" };
      } catch (error) {
        return {
          scenario,
          results: null,
          error: error instanceof Error ? error.message : "Calculation failed.",
        };
      }
    });
  }, [assumptions]);

  function updateNumber(key: NumericKey, value: number, source: InputSource = "user-override") {
    setAssumptions((current) => ({
      ...current,
      [key]: value,
      inputSources: { ...current.inputSources, [key]: source },
    }));
  }

  function updateScenario(key: keyof ScenarioDefinition["overrides"], value: number) {
    setScenarios((current) => current.map((scenario, index) =>
      index === selectedScenario
        ? { ...scenario, overrides: { ...scenario.overrides, [key]: value } }
        : scenario,
    ));
  }

  function addCustomScenario() {
    setScenarios((current) => {
      const next = [...current, {
        name: `Custom ${current.filter((scenario) => scenario.type === "custom").length + 1}`,
        type: "custom" as const,
        overrides: {},
      }];
      setSelectedScenario(next.length - 1);
      return next;
    });
  }

  function renameSelectedScenario(name: string) {
    setScenarios((current) => current.map((scenario, index) =>
      index === selectedScenario ? { ...scenario, name } : scenario,
    ));
  }

  async function saveModel() {
    setMessage("");
    const response = await fetch("/api/financial-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: currentModelId, assumptions, scenarios }),
    });
    const payload = (await response.json()) as { modelId?: number; version?: number; error?: string; details?: string[] };
    if (!response.ok) {
      setMessage(payload.details?.join(" ") ?? payload.error ?? "Model could not be saved.");
      return;
    }
    setCurrentModelId(payload.modelId ?? null);
    setMessage(`Saved model version ${payload.version}. Calculation version ${CALCULATION_VERSION}.`);
  }

  async function exportProjection() {
    if (!active) {
      setMessage("Add a valid scenario before exporting.");
      return;
    }
    const response = await fetch("/api/financial-models/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assumptions, scenario: active.scenario }),
    });
    if (!response.ok) {
      setMessage("Projection export could not be generated.");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nii-financial-projection.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="scope-strip underwriting-scope">
        <strong>Underwriting model</strong>
        <span>{CALCULATION_VERSION}</span>
        <span>Pre-tax · {assumptions.projectionYears} years</span>
      </div>
      <div className="underwriting-actions">
        <div className="segmented">
          <button className={mode === "detailed" ? "active" : ""} onClick={() => setMode("detailed")}>Detailed analysis</button>
          <button className={mode === "quick" ? "active" : ""} onClick={() => setMode("quick")}>Quick analysis</button>
        </div>
        <div className="actions">
          <button className="button" onClick={() => void exportProjection()}>Export projection</button>
          <button className="button primary" onClick={() => void saveModel()}>Save version</button>
        </div>
      </div>
      {message ? <p className="status-message" role="status">{message}</p> : null}
      <div className="underwriting-layout">
        <aside className="assumption-panel">
          {mode === "quick" ? (
            <div className="quick-stepper" aria-label="Quick analysis steps">
              {quickSteps.map((step, index) => (
                <button
                  className={quickStep === index ? "active" : ""}
                  key={step}
                  onClick={() => setQuickStep(index)}
                >
                  <span>{index + 1}</span>{step}
                </button>
              ))}
            </div>
          ) : null}
          {mode === "quick" && quickStep === 0 ? (
            <div className="listing-link-card">
              <label className="field" htmlFor="listing-link">
                <span>Property listing link</span>
                <input
                  id="listing-link"
                  onChange={(event) => setListingLink(event.target.value)}
                  placeholder="Paste a property URL"
                  type="url"
                  value={listingLink}
                />
              </label>
              <button className="button" disabled={!listingLink} onClick={() => void importListingLink()}>
                Check listing link
              </button>
              <small>We retain the link as evidence and use available property facts. Protected pages are not scraped.</small>
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="model-name">Model name</label>
            <input id="model-name" value={assumptions.modelName} onChange={(event) => setAssumptions({ ...assumptions, modelName: event.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="purchase-mode">Purchase structure</label>
            <select id="purchase-mode" value={assumptions.purchaseMode} onChange={(event) => setAssumptions({ ...assumptions, purchaseMode: event.target.value as "loan" | "cash" })}>
              <option value="loan">Financed purchase</option>
              <option value="cash">Cash purchase</option>
            </select>
          </div>
          {sections
            .filter((_, sectionIndex) =>
              mode === "detailed" || (quickStep < 4 && sectionIndex === quickStep)
            )
            .map((section) => (
            <details className="assumption-section" open key={section.title}>
              <summary>{section.title}</summary>
              <div className="assumption-grid">
                {section.fields
                  .filter((field) =>
                    mode === "detailed" || quickFieldKeys[quickStep].includes(field.key)
                  )
                  .map((field) => (
                  <NumberField
                    key={field.key}
                    label={field.label}
                    kind={field.kind}
                    value={assumptions[field.key] as number}
                    onChange={(value) => updateNumber(field.key, value)}
                  />
                ))}
              </div>
              {section.title === "Operating expenses" ? (
                <div className="property-tax-summary">
                  <div>
                    <span>Annual property tax</span>
                    <strong>{money(assumptions.annualPropertyTaxes)}</strong>
                    <small>
                      Calculated automatically: {money(assumptions.offerPrice)} offer ×{" "}
                      {percent(assumptions.propertyTaxRate)} tax rate.
                    </small>
                  </div>
                  {assumptions.propertyId ? (
                    <button className="button" onClick={() => void estimateTaxes()}>
                      Refresh verified tax
                    </button>
                  ) : null}
                </div>
              ) : null}
            </details>
          ))}
          {mode === "quick" && quickStep === 4 ? (
            <div className="method-note">
              Review the essential returns and scenario comparison on the right. Detailed analysis
              adds exit assumptions, the full projection, stress tests, and sensitivity controls.
            </div>
          ) : null}
          <div className="assumption-grid">
            <div className="field">
              <label htmlFor="projection-years">Projection period</label>
              <select id="projection-years" value={assumptions.projectionYears} onChange={(event) => setAssumptions({ ...assumptions, projectionYears: Number(event.target.value) as 5 | 10 })}>
                <option value="5">5 years</option><option value="10">10 years</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="exit-valuation">Exit valuation</label>
              <select id="exit-valuation" value={assumptions.exitValuation} onChange={(event) => setAssumptions({ ...assumptions, exitValuation: event.target.value as "appreciation" | "exit-cap" })}>
                <option value="appreciation">Appreciation</option><option value="exit-cap">Forward NOI / exit cap</option>
              </select>
            </div>
          </div>
          <div className="method-note">
            Review assumptions before relying on results. No missing expense or financing
            assumption is added silently.
          </div>
          {mode === "quick" ? (
            <div className="quick-navigation">
              <button className="button" disabled={quickStep === 0} onClick={() => setQuickStep((step) => Math.max(0, step - 1))}>Back</button>
              <button className="button primary" disabled={quickStep === 4} onClick={() => setQuickStep((step) => Math.min(4, step + 1))}>Next</button>
            </div>
          ) : null}
        </aside>

        <section className="underwriting-results">
          <div className="scenario-tabs">
            {scenarioResults.map(({ scenario }, index) => (
              <button className={index === selectedScenario ? "active" : ""} onClick={() => setSelectedScenario(index)} key={`${scenario.type}-${index}`}>{scenario.name}</button>
            ))}
            {scenarios.length < 8 ? <button onClick={addCustomScenario}>+ Custom</button> : null}
          </div>
          {selectedScenario > 0 ? (
            <div className="scenario-editor">
              <div className="field scenario-name-field">
                <label htmlFor="scenario-name">Scenario name</label>
                <input
                  id="scenario-name"
                  value={active.scenario.name}
                  onChange={(event) => renameSelectedScenario(event.target.value)}
                />
              </div>
              {([
                ["rentGrowth", "signed-percent"],
                ["vacancyRate", "percent"],
                ["expenseGrowth", "percent"],
                ["appreciationRate", "signed-percent"],
                ["exitCapRate", "percent"],
                ["interestRate", "percent"],
                ["renovationBudget", undefined],
                ["leaseUpMonths", "months"],
                ["exitValueAdjustment", "signed-percent"],
              ] as const).map(([key, kind]) => (
                <NumberField
                  key={key}
                  label={key.replace(/([A-Z])/g, " $1")}
                  kind={kind}
                  value={Number(active.scenario.overrides[key] ?? assumptions[key])}
                  onChange={(value) => updateScenario(key, value)}
                />
              ))}
            </div>
          ) : null}
          {active.error || !active.results ? (
            <div className="method-note" role="alert">{active.error}</div>
          ) : (
            <Results
              mode={mode}
              results={active.results}
              scenarioResults={scenarioResults}
              stressResults={stressResults}
              sensitivityAssumptions={applyScenario(assumptions, active.scenario)}
            />
          )}
        </section>
      </div>
    </>
  );
}

function NumberField({
  label, kind, value, onChange,
}: {
  label: string;
  kind?: "percent" | "signed-percent" | "years" | "months";
  value: number;
  onChange: (value: number) => void;
}) {
  const isPercent = kind === "percent" || kind === "signed-percent";
  const displayValue = isPercent
    ? normalizeFinancialNumber(value * 100, 4)
    : normalizeFinancialNumber(value, 4);
  return (
    <div className="field numeric-field">
      <label><span>{label}</span></label>
      <div className="number-input">
        {kind === "percent" || kind === "signed-percent" || kind === "years" || kind === "months" ? null : <span>$</span>}
        <input
          aria-label={label}
          inputMode="decimal"
          type="number"
          min={kind === "signed-percent" ? "-99" : "0"}
          max={kind === "months" ? "12" : undefined}
          step={kind === "percent" || kind === "signed-percent" ? "0.1" : kind === "years" || kind === "months" ? "1" : "100"}
          value={Number.isFinite(displayValue) ? displayValue : 0}
          onChange={(event) => onChange(normalizeFinancialNumber(
            Number(event.target.value) / (isPercent ? 100 : 1),
          ))}
        />
        {kind === "percent" || kind === "signed-percent" ? <span>%</span> : kind === "years" ? <span>yr</span> : kind === "months" ? <span>mo</span> : null}
      </div>
    </div>
  );
}

function Results({
  mode,
  results,
  scenarioResults,
  stressResults,
  sensitivityAssumptions,
}: {
  mode: "quick" | "detailed";
  results: FinancialResults;
  scenarioResults: Array<{ scenario: ScenarioDefinition; results: FinancialResults | null; error: string }>;
  stressResults: Array<{ scenario: ScenarioDefinition; results: FinancialResults | null; error: string }>;
  sensitivityAssumptions: FinancialAssumptions;
}) {
  const metrics = [
    { label: "Initial cash", value: money(results.initialCashInvested) },
    { label: "Year-one cash flow", value: money(results.yearOneCashFlow) },
    { label: "Cap rate", value: percent(results.capRate) },
    { label: "Cash-on-cash", value: percent(results.cashOnCashReturn) },
    {
      label: "DSCR",
      value: results.dscr?.toFixed(2) ?? "N/A",
      help: {
        definition: "Debt service coverage ratio shows whether property income covers scheduled loan payments.",
        formula: "Year-one NOI ÷ annual debt service",
      },
    },
    { label: "Levered IRR", value: percent(results.leveredIrr) },
    {
      label: "Year-one NOI",
      value: money(results.yearOneNoi),
      help: {
        definition: "Net operating income is property income after operating expenses, before debt service and income taxes.",
        formula: "Effective gross income − operating expenses",
      },
    },
    { label: "Equity multiple", value: multiple(results.equityMultiple) },
    {
      label: "NPV",
      value: money(results.netPresentValue),
      help: {
        definition: "Net present value converts projected cash flows into today’s dollars using your selected discount rate.",
        formula: `Present value of cash flows at ${percent(sensitivityAssumptions.discountRate)} − initial investment`,
      },
    },
    { label: "Break-even occupancy", value: percent(results.breakEvenOccupancy) },
    { label: "Required reserves", value: money(results.requiredCashReserves) },
    { label: "Projected sale price", value: money(results.projectedSalePrice) },
    {
      label: `Total profit · ${sensitivityAssumptions.projectionYears}-year total`,
      value: money(results.totalProfit),
      detail: "Cumulative pre-tax cash flows, including the projected sale, less all equity invested.",
    },
  ];
  return (
    <>
      <div className="return-grid">
        {(mode === "quick" ? metrics.slice(0, 6) : metrics).map((metric) => (
          <Metric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            help={metric.help}
          />
        ))}
      </div>
      <section className="detail-card underwriting-card">
        <h2>Scenario comparison</h2>
        <div className="table-wrap">
          <table className="comparison-table">
            <thead><tr><th>Scenario</th><th>Cash flow</th><th>Cap rate</th><th>CoC</th><th>DSCR</th><th>IRR</th><th>Equity multiple</th></tr></thead>
            <tbody>
              {scenarioResults.map(({ scenario, results: item }) => (
                <tr key={scenario.name}>
                  <td>{scenario.name}</td>
                  <td>{money(item?.yearOneCashFlow ?? null)}</td>
                  <td>{percent(item?.capRate ?? null)}</td>
                  <td>{percent(item?.cashOnCashReturn ?? null)}</td>
                  <td>{item?.dscr?.toFixed(2) ?? "N/A"}</td>
                  <td>{percent(item?.leveredIrr ?? null)}</td>
                  <td>{multiple(item?.equityMultiple ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {mode === "detailed" ? <SensitivityPanel assumptions={sensitivityAssumptions} /> : null}
      {mode === "detailed" ? (
        <>
      <section className="detail-card underwriting-card">
        <h2>Stress tests</h2>
        <p className="drawer-lead">
          Each preset changes one base assumption and leaves every other input unchanged.
        </p>
        <div className="table-wrap">
          <table className="comparison-table">
            <thead><tr><th>Shock</th><th>Cash flow</th><th>DSCR</th><th>IRR</th><th>Required reserves</th><th>First negative year</th></tr></thead>
            <tbody>
              {stressResults.map(({ scenario, results: item, error }) => (
                <tr key={scenario.name}>
                  <td>{scenario.name}</td>
                  <td>{error ? "Invalid" : money(item?.yearOneCashFlow ?? null)}</td>
                  <td>{item?.dscr?.toFixed(2) ?? "N/A"}</td>
                  <td>{percent(item?.leveredIrr ?? null)}</td>
                  <td>{money(item?.requiredCashReserves ?? null)}</td>
                  <td>{item?.firstNegativeCashFlowYear ?? "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="detail-card underwriting-card">
        <h2>Annual projection</h2>
        <div className="table-wrap">
          <table className="comparison-table projection-table">
            <thead><tr><th>Year</th><th>Gross income</th><th>Lease-up loss</th><th>EGI</th><th>OpEx</th><th>NOI</th><th>Debt</th><th>Cash flow</th><th>Loan balance</th><th>Sale proceeds</th></tr></thead>
            <tbody>
              {results.projections.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td><td>{money(row.grossPotentialIncome)}</td>
                  <td>{money(row.leaseUpLoss)}</td>
                  <td>{money(row.effectiveGrossIncome)}</td><td>{money(row.operatingExpenses)}</td>
                  <td>{money(row.netOperatingIncome)}</td><td>{money(row.debtService)}</td>
                  <td>{money(row.preTaxCashFlow)}</td><td>{money(row.endingLoanBalance)}</td>
                  <td>{money(row.saleProceeds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="detail-card underwriting-card">
        <h2>Formula audit</h2>
        <div className="formula-grid">
          {results.formulas.map((formula) => (
            <div className="source-item" key={formula.metric}>
              <strong>{formula.metric}</strong><span>{formula.formula} | {formula.units}</span>
            </div>
          ))}
        </div>
        {results.warnings.map((warning) => <div className="method-note" key={warning}>{warning}</div>)}
      </section>
        </>
      ) : null}
    </>
  );
}

function Metric({
  label,
  value,
  detail,
  help,
}: {
  label: string;
  value: string;
  detail?: string;
  help?: { definition: string; formula: string };
}) {
  return (
    <div className="metric-tile">
      <span className="metric-label">
        {label}
        {help ? (
          <button
            className="metric-help"
            type="button"
            aria-label={`Definition of ${label}`}
          >
            ?
            <span className="metric-tooltip" role="tooltip">
              <strong>{help.definition}</strong>
              <small>Formula: {help.formula}</small>
            </span>
          </button>
        ) : null}
      </span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}
