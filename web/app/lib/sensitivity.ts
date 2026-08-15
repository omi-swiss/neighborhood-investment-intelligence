import {
  calculateFinancialModel,
  type FinancialAssumptions,
  type FinancialResults,
} from "./financial-model";

export type SensitivityMetric =
  | "leveredIrr"
  | "cashOnCashReturn"
  | "netPresentValue"
  | "dscr";

export type SensitivityPair =
  | "purchase-price-rent"
  | "interest-rate-purchase-price"
  | "vacancy-rent-growth"
  | "renovation-exit-value"
  | "exit-cap-rent-growth"
  | "down-payment-interest-rate";

export const sensitivityPairLabels: Record<SensitivityPair, string> = {
  "purchase-price-rent": "Purchase price vs. rent",
  "interest-rate-purchase-price": "Interest rate vs. purchase price",
  "vacancy-rent-growth": "Vacancy vs. rent growth",
  "renovation-exit-value": "Renovation cost vs. exit value",
  "exit-cap-rent-growth": "Exit cap rate vs. rent growth",
  "down-payment-interest-rate": "Down payment vs. interest rate",
};

export const sensitivityMetricLabels: Record<SensitivityMetric, string> = {
  leveredIrr: "Levered IRR",
  cashOnCashReturn: "Cash-on-cash",
  netPresentValue: "NPV",
  dscr: "DSCR",
};

type AxisPoint = {
  label: string;
  apply: (assumptions: FinancialAssumptions) => FinancialAssumptions;
};

export type SensitivityMatrix = {
  pair: SensitivityPair;
  metric: SensitivityMetric;
  xLabel: string;
  yLabel: string;
  xValues: string[];
  yValues: string[];
  cells: Array<Array<number | null>>;
};

export type SensitivityDriver = {
  key: string;
  label: string;
  lowLabel: string;
  highLabel: string;
  lowValue: number | null;
  highValue: number | null;
  impact: number | null;
};

const relativeSteps = [-0.1, -0.05, 0, 0.05, 0.1];
const rateSteps = [-0.02, -0.01, 0, 0.01, 0.02];

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function metricValue(results: FinancialResults, metric: SensitivityMetric) {
  return results[metric];
}

function safeCalculate(assumptions: FinancialAssumptions, metric: SensitivityMetric) {
  try {
    return metricValue(calculateFinancialModel(assumptions), metric);
  } catch {
    return null;
  }
}

function relativeAxis(
  key: "offerPrice" | "monthlyRent",
  base: number,
): AxisPoint[] {
  return relativeSteps.map((step) => {
    const value = Math.max(1, base * (1 + step));
    return {
      label: money(value),
      apply: (assumptions) => ({ ...assumptions, [key]: value }),
    };
  });
}

function rateAxis(
  key: "interestRate" | "vacancyRate" | "rentGrowth" | "exitCapRate" | "downPaymentPercent",
  base: number,
): AxisPoint[] {
  return rateSteps.map((step) => {
    const value = Math.max(key === "rentGrowth" ? -0.99 : 0, Math.min(1, base + step));
    return {
      label: percent(value),
      apply: (assumptions) => ({ ...assumptions, [key]: value }),
    };
  });
}

function renovationAxis(base: number): AxisPoint[] {
  const unit = Math.max(base * 0.1, 12_500);
  return [-2, -1, 0, 1, 2].map((step) => {
    const value = Math.max(0, base + unit * step);
    return {
      label: money(value),
      apply: (assumptions) => ({ ...assumptions, renovationBudget: value }),
    };
  });
}

function exitValueAxis(base: number): AxisPoint[] {
  return relativeSteps.map((step) => {
    const value = Math.max(-0.99, Math.min(1, base + step));
    return {
      label: percent(value),
      apply: (assumptions) => ({ ...assumptions, exitValueAdjustment: value }),
    };
  });
}

function axesFor(
  assumptions: FinancialAssumptions,
  pair: SensitivityPair,
): { xLabel: string; yLabel: string; x: AxisPoint[]; y: AxisPoint[] } {
  switch (pair) {
    case "purchase-price-rent":
      return {
        xLabel: "Offer price",
        yLabel: "Monthly rent",
        x: relativeAxis("offerPrice", assumptions.offerPrice),
        y: relativeAxis("monthlyRent", assumptions.monthlyRent),
      };
    case "interest-rate-purchase-price":
      return {
        xLabel: "Interest rate",
        yLabel: "Offer price",
        x: rateAxis("interestRate", assumptions.interestRate),
        y: relativeAxis("offerPrice", assumptions.offerPrice),
      };
    case "vacancy-rent-growth":
      return {
        xLabel: "Vacancy",
        yLabel: "Rent growth",
        x: rateAxis("vacancyRate", assumptions.vacancyRate),
        y: rateAxis("rentGrowth", assumptions.rentGrowth),
      };
    case "renovation-exit-value":
      return {
        xLabel: "Renovation budget",
        yLabel: "Exit value adjustment",
        x: renovationAxis(assumptions.renovationBudget),
        y: exitValueAxis(assumptions.exitValueAdjustment),
      };
    case "exit-cap-rent-growth":
      return {
        xLabel: "Exit cap rate",
        yLabel: "Rent growth",
        x: rateAxis("exitCapRate", assumptions.exitCapRate),
        y: rateAxis("rentGrowth", assumptions.rentGrowth),
      };
    case "down-payment-interest-rate":
      return {
        xLabel: "Down payment",
        yLabel: "Interest rate",
        x: rateAxis("downPaymentPercent", assumptions.downPaymentPercent),
        y: rateAxis("interestRate", assumptions.interestRate),
      };
  }
}

export function buildSensitivityMatrix(
  assumptions: FinancialAssumptions,
  pair: SensitivityPair,
  metric: SensitivityMetric,
): SensitivityMatrix {
  const axes = axesFor(assumptions, pair);
  return {
    pair,
    metric,
    xLabel: axes.xLabel,
    yLabel: axes.yLabel,
    xValues: axes.x.map((point) => point.label),
    yValues: axes.y.map((point) => point.label),
    cells: axes.y.map((yPoint) =>
      axes.x.map((xPoint) =>
        safeCalculate(xPoint.apply(yPoint.apply(assumptions)), metric),
      ),
    ),
  };
}

export function rankSensitivityDrivers(
  assumptions: FinancialAssumptions,
  metric: SensitivityMetric,
): SensitivityDriver[] {
  const shocks: Array<{
    key: string;
    label: string;
    lowLabel: string;
    highLabel: string;
    low: (value: FinancialAssumptions) => FinancialAssumptions;
    high: (value: FinancialAssumptions) => FinancialAssumptions;
  }> = [
    {
      key: "offerPrice",
      label: "Offer price",
      lowLabel: "-10%",
      highLabel: "+10%",
      low: (value) => ({ ...value, offerPrice: value.offerPrice * 0.9 }),
      high: (value) => ({ ...value, offerPrice: value.offerPrice * 1.1 }),
    },
    {
      key: "monthlyRent",
      label: "Monthly rent",
      lowLabel: "-10%",
      highLabel: "+10%",
      low: (value) => ({ ...value, monthlyRent: value.monthlyRent * 0.9 }),
      high: (value) => ({ ...value, monthlyRent: value.monthlyRent * 1.1 }),
    },
    {
      key: "interestRate",
      label: "Interest rate",
      lowLabel: "-1.0 pt",
      highLabel: "+1.0 pt",
      low: (value) => ({ ...value, interestRate: Math.max(0, value.interestRate - 0.01) }),
      high: (value) => ({ ...value, interestRate: value.interestRate + 0.01 }),
    },
    {
      key: "vacancyRate",
      label: "Vacancy",
      lowLabel: "-2.0 pts",
      highLabel: "+2.0 pts",
      low: (value) => ({ ...value, vacancyRate: Math.max(0, value.vacancyRate - 0.02) }),
      high: (value) => ({ ...value, vacancyRate: Math.min(0.95, value.vacancyRate + 0.02) }),
    },
    {
      key: "renovationBudget",
      label: "Renovation budget",
      lowLabel: "-20%",
      highLabel: "+20%",
      low: (value) => ({ ...value, renovationBudget: value.renovationBudget * 0.8 }),
      high: (value) => ({
        ...value,
        renovationBudget: value.renovationBudget + Math.max(value.renovationBudget * 0.2, 25_000),
      }),
    },
    {
      key: "exitCapRate",
      label: "Exit cap rate",
      lowLabel: "-0.5 pt",
      highLabel: "+0.5 pt",
      low: (value) => ({ ...value, exitCapRate: Math.max(0.001, value.exitCapRate - 0.005) }),
      high: (value) => ({ ...value, exitCapRate: value.exitCapRate + 0.005 }),
    },
    {
      key: "exitValueAdjustment",
      label: "Exit value",
      lowLabel: "-10%",
      highLabel: "+10%",
      low: (value) => ({ ...value, exitValueAdjustment: Math.max(-0.99, value.exitValueAdjustment - 0.1) }),
      high: (value) => ({ ...value, exitValueAdjustment: Math.min(1, value.exitValueAdjustment + 0.1) }),
    },
  ];
  return shocks
    .map((shock) => {
      const lowValue = safeCalculate(shock.low(assumptions), metric);
      const highValue = safeCalculate(shock.high(assumptions), metric);
      return {
        key: shock.key,
        label: shock.label,
        lowLabel: shock.lowLabel,
        highLabel: shock.highLabel,
        lowValue,
        highValue,
        impact:
          lowValue === null || highValue === null ? null : Math.abs(highValue - lowValue),
      };
    })
    .sort((a, b) => (b.impact ?? -1) - (a.impact ?? -1));
}
