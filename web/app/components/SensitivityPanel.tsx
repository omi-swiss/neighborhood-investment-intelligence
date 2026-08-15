"use client";

import { useMemo, useState } from "react";
import type { FinancialAssumptions } from "../lib/financial-model";
import {
  buildSensitivityMatrix,
  rankSensitivityDrivers,
  sensitivityMetricLabels,
  sensitivityPairLabels,
  type SensitivityMetric,
  type SensitivityPair,
} from "../lib/sensitivity";

const pairs = Object.keys(sensitivityPairLabels) as SensitivityPair[];
const metrics = Object.keys(sensitivityMetricLabels) as SensitivityMetric[];

function formatMetric(value: number | null, metric: SensitivityMetric) {
  if (value === null) return "N/A";
  if (metric === "netPresentValue") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (metric === "dscr") return value.toFixed(2);
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function SensitivityPanel({ assumptions }: { assumptions: FinancialAssumptions }) {
  const [pair, setPair] = useState<SensitivityPair>("purchase-price-rent");
  const [metric, setMetric] = useState<SensitivityMetric>("leveredIrr");
  const matrix = useMemo(
    () => buildSensitivityMatrix(assumptions, pair, metric),
    [assumptions, metric, pair],
  );
  const drivers = useMemo(
    () => rankSensitivityDrivers(assumptions, metric),
    [assumptions, metric],
  );
  const finiteCells = matrix.cells.flat().filter((value): value is number => value !== null);
  const minimum = finiteCells.length ? Math.min(...finiteCells) : 0;
  const maximum = finiteCells.length ? Math.max(...finiteCells) : 0;
  const activeValue = matrix.cells[2]?.[2] ?? null;
  const leadingDriver = drivers[0];

  return (
    <section className="detail-card underwriting-card sensitivity-card">
      <div className="sensitivity-heading">
        <div>
          <h2>Sensitivity analysis</h2>
          <p className="drawer-lead">
            See how two assumptions change one return measure while everything else stays fixed.
          </p>
        </div>
        <div className="sensitivity-selectors">
          <label>
            Test inputs
            <select value={pair} onChange={(event) => setPair(event.target.value as SensitivityPair)}>
              {pairs.map((key) => <option value={key} key={key}>{sensitivityPairLabels[key]}</option>)}
            </select>
          </label>
          <label>
            Measure
            <select value={metric} onChange={(event) => setMetric(event.target.value as SensitivityMetric)}>
              {metrics.map((key) => <option value={key} key={key}>{sensitivityMetricLabels[key]}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="sensitivity-guide" aria-label="How to read sensitivity analysis">
        <div>
          <span>1</span>
          <p><strong>Choose two inputs.</strong> Columns change the first; rows change the second.</p>
        </div>
        <div>
          <span>2</span>
          <p><strong>Find the outlined center.</strong> That is your current underwriting case.</p>
        </div>
        <div>
          <span>3</span>
          <p><strong>Compare nearby cells.</strong> Darker green means a higher selected return measure, not a probability.</p>
        </div>
      </div>
      <div className="sensitivity-summary">
        <div>
          <span>Current case</span>
          <strong>{formatMetric(activeValue, metric)}</strong>
        </div>
        <div>
          <span>Largest modeled driver</span>
          <strong>{leadingDriver?.label ?? "Unavailable"}</strong>
        </div>
      </div>
      <div className="table-wrap">
        <table className="sensitivity-table">
          <thead>
            <tr>
              <th>{matrix.yLabel} ↓<br />{matrix.xLabel} →</th>
              {matrix.xValues.map((value) => <th key={value}>{value}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.cells.map((row, rowIndex) => (
              <tr key={matrix.yValues[rowIndex]}>
                <th>{matrix.yValues[rowIndex]}</th>
                {row.map((value, columnIndex) => {
                  const intensity =
                    value === null || maximum === minimum
                      ? 0.5
                      : (value - minimum) / (maximum - minimum);
                  return (
                    <td
                      className={rowIndex === 2 && columnIndex === 2 ? "base-cell" : ""}
                      aria-label={`${matrix.yLabel} ${matrix.yValues[rowIndex]}, ${matrix.xLabel} ${matrix.xValues[columnIndex]}: ${formatMetric(value, metric)}`}
                      style={{
                        backgroundColor:
                          value === null
                            ? "#f4f1e8"
                            : `rgba(23, 79, 60, ${0.08 + intensity * 0.28})`,
                      }}
                      key={`${rowIndex}-${columnIndex}`}
                    >
                      {formatMetric(value, metric)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pair === "exit-cap-rent-growth" && assumptions.exitValuation !== "exit-cap" ? (
        <div className="method-note">
          The model currently uses appreciation for the exit value. Exit-cap changes will matter
          after the exit method is changed to forward NOI / exit cap.
        </div>
      ) : null}
      {pair === "down-payment-interest-rate" && assumptions.purchaseMode === "cash" ? (
        <div className="method-note">
          This is a cash purchase, so financing changes do not affect returns.
        </div>
      ) : null}
      <h3 className="subsection-title">Largest modeled drivers</h3>
      <div className="driver-list">
        {drivers.slice(0, 3).map((driver) => (
          <div className="driver-row" key={driver.key}>
            <strong>{driver.label}</strong>
            <span>{driver.lowLabel}: {formatMetric(driver.lowValue, metric)}</span>
            <span>{driver.highLabel}: {formatMetric(driver.highValue, metric)}</span>
            <b>Range impact: {formatMetric(driver.impact, metric)}</b>
          </div>
        ))}
      </div>
      <div className="method-note">
        These are controlled what-if calculations, not forecasts. A wider range means the result
        depends more heavily on that assumption.
      </div>
    </section>
  );
}
