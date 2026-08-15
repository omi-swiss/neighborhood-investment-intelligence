export const CALCULATION_VERSION = "nii-underwriting-v1.3.0";

export type InputSource =
  | "user-override"
  | "property-observed"
  | "neighborhood-estimate"
  | "system-default";

export type FinancialAssumptions = {
  modelName: string;
  propertyId: number | null;
  purchasePrice: number;
  offerPrice: number;
  closingCosts: number;
  inspectionLegalCosts: number;
  renovationBudget: number;
  initialReserves: number;
  purchaseMode: "loan" | "cash";
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  amortizationYears: number;
  interestOnlyYears: number;
  pointsPercent: number;
  originationFees: number;
  monthlyRent: number;
  otherMonthlyIncome: number;
  leaseUpMonths: number;
  rentGrowth: number;
  vacancyRate: number;
  creditLossRate: number;
  propertyTaxRate: number;
  annualPropertyTaxes: number;
  annualInsurance: number;
  hoaMonthly: number;
  utilitiesMonthly: number;
  otherAnnualExpenses: number;
  managementPercent: number;
  maintenancePercent: number;
  capitalReservePercent: number;
  expenseGrowth: number;
  appreciationRate: number;
  sellingCostRate: number;
  exitCapRate: number;
  exitValueAdjustment: number;
  exitValuation: "appreciation" | "exit-cap";
  discountRate: number;
  projectionYears: 5 | 10;
  inputSources: Record<string, InputSource>;
};

export type ScenarioType = "base" | "conservative" | "optimistic" | "custom";

export type ScenarioDefinition = {
  name: string;
  type: ScenarioType;
  overrides: Partial<Pick<
    FinancialAssumptions,
    | "monthlyRent"
    | "rentGrowth"
    | "vacancyRate"
    | "expenseGrowth"
    | "appreciationRate"
    | "exitCapRate"
    | "interestRate"
    | "renovationBudget"
    | "annualPropertyTaxes"
    | "annualInsurance"
    | "managementPercent"
    | "maintenancePercent"
    | "leaseUpMonths"
    | "exitValueAdjustment"
  >>;
};

export type ProjectionRow = {
  year: number;
  grossPotentialIncome: number;
  leaseUpLoss: number;
  vacancyAndCreditLoss: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  netOperatingIncome: number;
  capitalReserves: number;
  debtService: number;
  principalPaid: number;
  interestPaid: number;
  endingLoanBalance: number;
  preTaxCashFlow: number;
  saleProceeds: number;
  totalCashFlow: number;
};

export type FinancialResults = {
  calculationVersion: string;
  totalAcquisitionCost: number;
  loanAmount: number;
  initialCashInvested: number;
  monthlyDebtService: number;
  yearOneNoi: number;
  yearOneCashFlow: number;
  capRate: number | null;
  cashOnCashReturn: number | null;
  dscr: number | null;
  loanToValue: number | null;
  loanToCost: number | null;
  grossRentMultiplier: number | null;
  operatingExpenseRatio: number | null;
  breakEvenOccupancy: number | null;
  rentNeededToBreakEvenMonthly: number | null;
  leveredIrr: number | null;
  unleveredIrr: number | null;
  equityMultiple: number | null;
  netPresentValue: number;
  totalProfit: number;
  projectedSalePrice: number;
  saleProceeds: number;
  requiredCashReserves: number;
  firstNegativeCashFlowYear: number | null;
  projections: ProjectionRow[];
  formulas: Array<{ metric: string; formula: string; units: string }>;
  warnings: string[];
};

export function normalizeFinancialNumber(value: number, digits = 8): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function normalizeFinancialAssumptions(
  assumptions: FinancialAssumptions,
): FinancialAssumptions {
  const normalized = { ...assumptions };
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === "number") {
      (normalized as unknown as Record<string, unknown>)[key] =
        normalizeFinancialNumber(value);
    }
  }
  return normalized;
}

const defaultSourceKeys = [
  "purchasePrice", "offerPrice", "closingCosts", "inspectionLegalCosts",
  "renovationBudget", "initialReserves", "downPaymentPercent", "interestRate",
  "loanTermYears", "amortizationYears", "interestOnlyYears", "pointsPercent",
  "originationFees", "monthlyRent", "otherMonthlyIncome", "leaseUpMonths", "rentGrowth",
  "vacancyRate", "creditLossRate", "propertyTaxRate", "annualPropertyTaxes", "annualInsurance",
  "hoaMonthly", "utilitiesMonthly", "otherAnnualExpenses", "managementPercent",
  "maintenancePercent", "capitalReservePercent", "expenseGrowth",
  "appreciationRate", "sellingCostRate", "exitCapRate", "exitValueAdjustment", "discountRate",
] as const;

export const defaultFinancialAssumptions: FinancialAssumptions = {
  modelName: "New underwriting model",
  propertyId: null,
  purchasePrice: 500_000,
  offerPrice: 500_000,
  closingCosts: 15_000,
  inspectionLegalCosts: 2_500,
  renovationBudget: 0,
  initialReserves: 10_000,
  purchaseMode: "loan",
  downPaymentPercent: 0.25,
  interestRate: 0.07,
  loanTermYears: 30,
  amortizationYears: 30,
  interestOnlyYears: 0,
  pointsPercent: 0,
  originationFees: 2_000,
  monthlyRent: 3_500,
  otherMonthlyIncome: 0,
  leaseUpMonths: 0,
  rentGrowth: 0.03,
  vacancyRate: 0.05,
  creditLossRate: 0.01,
  propertyTaxRate: 0.01,
  annualPropertyTaxes: 5_000,
  annualInsurance: 2_000,
  hoaMonthly: 0,
  utilitiesMonthly: 0,
  otherAnnualExpenses: 0,
  managementPercent: 0.08,
  maintenancePercent: 0.05,
  capitalReservePercent: 0.05,
  expenseGrowth: 0.03,
  appreciationRate: 0.03,
  sellingCostRate: 0.06,
  exitCapRate: 0.06,
  exitValueAdjustment: 0,
  exitValuation: "appreciation",
  discountRate: 0.1,
  projectionYears: 10,
  inputSources: Object.fromEntries(
    defaultSourceKeys.map((key) => [key, "system-default"]),
  ),
};

export const defaultScenarios: ScenarioDefinition[] = [
  { name: "Base case", type: "base", overrides: {} },
  {
    name: "Conservative",
    type: "conservative",
    overrides: {
      rentGrowth: 0.015,
      vacancyRate: 0.08,
      expenseGrowth: 0.04,
      appreciationRate: 0.01,
      exitCapRate: 0.0675,
    },
  },
  {
    name: "Optimistic",
    type: "optimistic",
    overrides: {
      rentGrowth: 0.04,
      vacancyRate: 0.035,
      expenseGrowth: 0.025,
      appreciationRate: 0.04,
      exitCapRate: 0.055,
    },
  },
];

const scenarioOverrideKeys = [
  "monthlyRent",
  "rentGrowth",
  "vacancyRate",
  "expenseGrowth",
  "appreciationRate",
  "exitCapRate",
  "interestRate",
  "renovationBudget",
  "annualPropertyTaxes",
  "annualInsurance",
  "managementPercent",
  "maintenancePercent",
  "leaseUpMonths",
  "exitValueAdjustment",
] as const;

function finiteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function finiteSignedRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > -1 && value <= 1;
}

export function validateFinancialAssumptions(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["Assumptions must be an object."];
  const assumptions = value as Partial<FinancialAssumptions>;
  const errors: string[] = [];
  const requiredNonnegative = defaultSourceKeys;
  for (const key of requiredNonnegative) {
    const valueForKey = assumptions[key];
    if (["rentGrowth", "appreciationRate", "exitValueAdjustment"].includes(key)) {
      if (!finiteSignedRate(valueForKey)) errors.push(`${key} must be greater than -1 and no more than 1.`);
    } else if (!finiteNonnegative(valueForKey)) {
      errors.push(`${key} must be a nonnegative number.`);
    }
  }
  if (!assumptions.modelName?.trim()) errors.push("modelName is required.");
  if ((assumptions.modelName?.trim().length ?? 0) > 120) errors.push("modelName must be 120 characters or fewer.");
  if (
    assumptions.propertyId !== null &&
    (!Number.isInteger(assumptions.propertyId) || (assumptions.propertyId ?? 0) <= 0)
  ) {
    errors.push("propertyId must be null or a positive integer.");
  }
  if (!["loan", "cash"].includes(assumptions.purchaseMode ?? "")) errors.push("purchaseMode is invalid.");
  if (![5, 10].includes(assumptions.projectionYears ?? 0)) errors.push("projectionYears must be 5 or 10.");
  if (!["appreciation", "exit-cap"].includes(assumptions.exitValuation ?? "")) errors.push("exitValuation is invalid.");
  const percentKeys: Array<keyof FinancialAssumptions> = [
    "downPaymentPercent", "interestRate", "pointsPercent", "rentGrowth",
    "vacancyRate", "creditLossRate", "managementPercent", "maintenancePercent",
    "capitalReservePercent", "expenseGrowth", "appreciationRate",
    "sellingCostRate", "exitCapRate", "discountRate", "propertyTaxRate",
  ];
  for (const key of percentKeys) {
    const number = assumptions[key];
    if (typeof number === "number" && number > 1) errors.push(`${key} must be entered as a decimal between 0 and 1.`);
  }
  if ((assumptions.offerPrice ?? 0) <= 0) errors.push("offerPrice must be greater than zero.");
  if ((assumptions.monthlyRent ?? 0) <= 0) errors.push("monthlyRent must be greater than zero.");
  if ((assumptions.amortizationYears ?? 0) <= 0) errors.push("amortizationYears must be greater than zero.");
  if ((assumptions.loanTermYears ?? 0) <= 0) errors.push("loanTermYears must be greater than zero.");
  if (!Number.isInteger(assumptions.amortizationYears)) errors.push("amortizationYears must be a whole number.");
  if (!Number.isInteger(assumptions.loanTermYears)) errors.push("loanTermYears must be a whole number.");
  if (!Number.isInteger(assumptions.interestOnlyYears)) errors.push("interestOnlyYears must be a whole number.");
  if (!Number.isInteger(assumptions.leaseUpMonths) || (assumptions.leaseUpMonths ?? 0) > 12) {
    errors.push("leaseUpMonths must be a whole number from 0 through 12.");
  }
  if ((assumptions.interestOnlyYears ?? 0) > (assumptions.loanTermYears ?? 0)) errors.push("interestOnlyYears cannot exceed the loan term.");
  if (
    assumptions.purchaseMode === "loan" &&
    (assumptions.loanTermYears ?? 0) < (assumptions.projectionYears ?? 0)
  ) {
    errors.push("loanTermYears must cover the projection period; refinancing is not silently assumed.");
  }
  if ((assumptions.vacancyRate ?? 0) + (assumptions.creditLossRate ?? 0) >= 1) {
    errors.push("vacancyRate plus creditLossRate must be less than 1.");
  }
  if (assumptions.exitValuation === "exit-cap" && (assumptions.exitCapRate ?? 0) <= 0) {
    errors.push("exitCapRate must be greater than zero when exit-cap valuation is selected.");
  }
  if (
    !assumptions.inputSources ||
    typeof assumptions.inputSources !== "object" ||
    Array.isArray(assumptions.inputSources)
  ) {
    errors.push("inputSources must be an object.");
  } else {
    const allowedSources: InputSource[] = [
      "user-override",
      "property-observed",
      "neighborhood-estimate",
      "system-default",
    ];
    if (Object.values(assumptions.inputSources).some((source) => !allowedSources.includes(source))) {
      errors.push("inputSources contains an invalid source label.");
    }
  }
  return errors;
}

export function validateScenarioDefinition(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["Scenario must be an object."];
  const scenario = value as Partial<ScenarioDefinition>;
  const errors: string[] = [];
  if (!scenario.name?.trim()) errors.push("Scenario name is required.");
  if ((scenario.name?.trim().length ?? 0) > 80) errors.push("Scenario name must be 80 characters or fewer.");
  if (!scenario.type || !["base", "conservative", "optimistic", "custom"].includes(scenario.type)) {
    errors.push("Scenario type is invalid.");
  }
  if (!scenario.overrides || typeof scenario.overrides !== "object" || Array.isArray(scenario.overrides)) {
    errors.push("Scenario overrides must be an object.");
    return errors;
  }
  for (const [key, value] of Object.entries(scenario.overrides)) {
    if (!scenarioOverrideKeys.includes(key as (typeof scenarioOverrideKeys)[number])) {
      errors.push(`${key} is not an allowed scenario override.`);
    } else if (["rentGrowth", "appreciationRate", "exitValueAdjustment"].includes(key)) {
      if (!finiteSignedRate(value)) errors.push(`${key} must be greater than -1 and no more than 1.`);
    } else if (!finiteNonnegative(value)) {
      errors.push(`${key} must be a nonnegative number.`);
    }
  }
  return errors;
}

function monthlyPayment(principal: number, annualRate: number, amortizationYears: number): number {
  if (principal <= 0) return 0;
  const periods = amortizationYears * 12;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return principal / periods;
  return principal * (monthlyRate * (1 + monthlyRate) ** periods) /
    ((1 + monthlyRate) ** periods - 1);
}

function irr(cashFlows: number[]): number | null {
  if (!cashFlows.some((value) => value < 0) || !cashFlows.some((value) => value > 0)) return null;
  const npvAt = (rate: number) =>
    cashFlows.reduce((sum, cashFlow, index) => sum + cashFlow / (1 + rate) ** index, 0);
  let low = -0.999;
  let high = 10;
  let lowValue = npvAt(low);
  const highValue = npvAt(high);
  if (lowValue * highValue > 0) return null;
  for (let index = 0; index < 200; index += 1) {
    const middle = (low + high) / 2;
    const value = npvAt(middle);
    if (Math.abs(value) < 0.01) return middle;
    if (value * lowValue > 0) {
      low = middle;
      lowValue = value;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
}

function safeDivide(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function applyScenario(
  assumptions: FinancialAssumptions,
  scenario: ScenarioDefinition,
): FinancialAssumptions {
  return { ...assumptions, ...scenario.overrides };
}

export function calculateFinancialModel(
  assumptions: FinancialAssumptions,
): FinancialResults {
  const errors = validateFinancialAssumptions(assumptions);
  if (errors.length) throw new Error(errors.join(" "));
  const price = assumptions.offerPrice;
  const loanAmount =
    assumptions.purchaseMode === "cash"
      ? 0
      : price * (1 - assumptions.downPaymentPercent);
  const points = loanAmount * assumptions.pointsPercent;
  const financingCosts =
    assumptions.purchaseMode === "loan" ? points + assumptions.originationFees : 0;
  const unleveredAcquisitionCost =
    price +
    assumptions.closingCosts +
    assumptions.inspectionLegalCosts +
    assumptions.renovationBudget +
    assumptions.initialReserves;
  const totalAcquisitionCost =
    unleveredAcquisitionCost + financingCosts;
  const initialCashInvested = totalAcquisitionCost - loanAmount;
  const scheduledPayment = monthlyPayment(
    loanAmount,
    assumptions.interestRate,
    assumptions.amortizationYears,
  );
  let balance = loanAmount;
  const rows: ProjectionRow[] = [];
  let projectedSalePrice = 0;
  let finalSaleProceeds = 0;

  for (let year = 1; year <= assumptions.projectionYears; year += 1) {
    const incomeGrowth = (1 + assumptions.rentGrowth) ** (year - 1);
    const expenseGrowth = (1 + assumptions.expenseGrowth) ** (year - 1);
    const grossPotentialIncome =
      (assumptions.monthlyRent + assumptions.otherMonthlyIncome) * 12 * incomeGrowth;
    const leaseUpLoss =
      year === 1 ? grossPotentialIncome * assumptions.leaseUpMonths / 12 : 0;
    const vacancyAndCreditLoss =
      leaseUpLoss +
      (grossPotentialIncome - leaseUpLoss) *
        (assumptions.vacancyRate + assumptions.creditLossRate);
    const effectiveGrossIncome = grossPotentialIncome - vacancyAndCreditLoss;
    const fixedExpenses =
      (assumptions.annualPropertyTaxes +
        assumptions.annualInsurance +
        assumptions.hoaMonthly * 12 +
        assumptions.utilitiesMonthly * 12 +
        assumptions.otherAnnualExpenses) *
      expenseGrowth;
    const variableExpenses =
      effectiveGrossIncome *
      (assumptions.managementPercent + assumptions.maintenancePercent);
    const operatingExpenses = fixedExpenses + variableExpenses;
    const netOperatingIncome = effectiveGrossIncome - operatingExpenses;
    const capitalReserves = effectiveGrossIncome * assumptions.capitalReservePercent;
    let debtService = 0;
    let principalPaid = 0;
    let interestPaid = 0;
    for (let month = 1; month <= 12 && balance > 0; month += 1) {
      const interest = balance * (assumptions.interestRate / 12);
      const inInterestOnlyPeriod = (year - 1) * 12 + month <= assumptions.interestOnlyYears * 12;
      const payment = inInterestOnlyPeriod ? interest : Math.min(scheduledPayment, balance + interest);
      const principal = Math.max(0, payment - interest);
      balance = Math.max(0, balance - principal);
      debtService += payment;
      principalPaid += principal;
      interestPaid += interest;
    }
    const preTaxCashFlow = netOperatingIncome - capitalReserves - debtService;
    let saleProceeds = 0;
    if (year === assumptions.projectionYears) {
      const nextYearGrossPotentialIncome =
        grossPotentialIncome * (1 + assumptions.rentGrowth);
      const nextYearEffectiveGrossIncome =
        nextYearGrossPotentialIncome *
        (1 - assumptions.vacancyRate - assumptions.creditLossRate);
      const nextYearFixedExpenses =
        fixedExpenses * (1 + assumptions.expenseGrowth);
      const nextYearVariableExpenses =
        nextYearEffectiveGrossIncome *
        (assumptions.managementPercent + assumptions.maintenancePercent);
      const nextYearNoi =
        nextYearEffectiveGrossIncome -
        nextYearFixedExpenses -
        nextYearVariableExpenses;
      projectedSalePrice =
        assumptions.exitValuation === "exit-cap"
          ? nextYearNoi / assumptions.exitCapRate
          : price * (1 + assumptions.appreciationRate) ** assumptions.projectionYears;
      projectedSalePrice *= 1 + assumptions.exitValueAdjustment;
      saleProceeds =
        projectedSalePrice * (1 - assumptions.sellingCostRate) - balance;
      finalSaleProceeds = saleProceeds;
    }
    rows.push({
      year,
      grossPotentialIncome,
      leaseUpLoss,
      vacancyAndCreditLoss,
      effectiveGrossIncome,
      operatingExpenses,
      netOperatingIncome,
      capitalReserves,
      debtService,
      principalPaid,
      interestPaid,
      endingLoanBalance: balance,
      preTaxCashFlow,
      saleProceeds,
      totalCashFlow: preTaxCashFlow + saleProceeds,
    });
  }
  const yearOne = rows[0];
  const leveredCashFlows = [-initialCashInvested, ...rows.map((row) => row.totalCashFlow)];
  const unleveredSale =
    projectedSalePrice * (1 - assumptions.sellingCostRate);
  const unleveredCashFlows = [
    -unleveredAcquisitionCost,
    ...rows.map((row, index) =>
      row.netOperatingIncome -
      row.capitalReserves +
      (index === rows.length - 1 ? unleveredSale : 0),
    ),
  ];
  const positiveDistributions = leveredCashFlows
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0);
  const totalEquityContributions = Math.abs(
    leveredCashFlows
      .filter((value) => value < 0)
      .reduce((sum, value) => sum + value, 0),
  );
  const npv = leveredCashFlows.reduce(
    (sum, value, index) => sum + value / (1 + assumptions.discountRate) ** index,
    0,
  );
  let cumulativeOperatingCashFlow = 0;
  let minimumCumulativeOperatingCashFlow = 0;
  for (const row of rows) {
    cumulativeOperatingCashFlow += row.preTaxCashFlow;
    minimumCumulativeOperatingCashFlow = Math.min(
      minimumCumulativeOperatingCashFlow,
      cumulativeOperatingCashFlow,
    );
  }
  const warnings = [
    "Pre-tax model: income taxes and depreciation are excluded.",
    "Market value, rent, and exit assumptions are user inputs, not appraisals.",
  ];
  if (assumptions.purchaseMode === "cash") warnings.push("Cash purchase: debt metrics are not applicable.");
  if (assumptions.leaseUpMonths > 0) {
    warnings.push(`Year one includes ${assumptions.leaseUpMonths} month(s) of lease-up loss.`);
  }
  if (assumptions.exitValuation === "exit-cap" && projectedSalePrice <= 0) {
    warnings.push("Forward NOI is nonpositive, so the exit-cap valuation is nonpositive.");
  }
  if (Object.values(assumptions.inputSources).some((source) => source === "system-default")) {
    warnings.push("One or more assumptions still need review before relying on results.");
  }
  return {
    calculationVersion: CALCULATION_VERSION,
    totalAcquisitionCost,
    loanAmount,
    initialCashInvested,
    monthlyDebtService: assumptions.purchaseMode === "cash" ? 0 : scheduledPayment,
    yearOneNoi: yearOne.netOperatingIncome,
    yearOneCashFlow: yearOne.preTaxCashFlow,
    capRate: safeDivide(yearOne.netOperatingIncome, price),
    cashOnCashReturn: safeDivide(yearOne.preTaxCashFlow, initialCashInvested),
    dscr: safeDivide(yearOne.netOperatingIncome, yearOne.debtService),
    loanToValue: safeDivide(loanAmount, price),
    loanToCost: safeDivide(loanAmount, totalAcquisitionCost),
    grossRentMultiplier: safeDivide(price, assumptions.monthlyRent * 12),
    operatingExpenseRatio: safeDivide(yearOne.operatingExpenses, yearOne.effectiveGrossIncome),
    breakEvenOccupancy: safeDivide(
      yearOne.operatingExpenses + yearOne.debtService + yearOne.capitalReserves,
      yearOne.grossPotentialIncome,
    ),
    rentNeededToBreakEvenMonthly: safeDivide(
      yearOne.operatingExpenses + yearOne.debtService + yearOne.capitalReserves,
      (12 - assumptions.leaseUpMonths) *
        (1 - assumptions.vacancyRate - assumptions.creditLossRate),
    ),
    leveredIrr: irr(leveredCashFlows),
    unleveredIrr: irr(unleveredCashFlows),
    equityMultiple: safeDivide(positiveDistributions, totalEquityContributions),
    netPresentValue: npv,
    totalProfit: leveredCashFlows.reduce((sum, value) => sum + value, 0),
    projectedSalePrice,
    saleProceeds: finalSaleProceeds,
    requiredCashReserves: Math.abs(minimumCumulativeOperatingCashFlow),
    firstNegativeCashFlowYear:
      rows.find((row) => row.preTaxCashFlow < 0)?.year ?? null,
    projections: rows,
    formulas: [
      { metric: "Lease-up loss", formula: "Year-one gross potential income × lease-up months / 12", units: "USD/year one" },
      { metric: "NOI", formula: "Effective gross income - operating expenses", units: "USD/year" },
      { metric: "Cap rate", formula: "Year-one NOI / offer price", units: "%" },
      { metric: "Cash-on-cash", formula: "Year-one pre-tax cash flow / initial cash invested", units: "%" },
      { metric: "DSCR", formula: "Year-one NOI / annual debt service", units: "ratio" },
      { metric: "Break-even occupancy", formula: "(Operating expenses + debt service + reserves) / gross potential income", units: "%" },
      { metric: "Levered IRR", formula: "Rate where NPV of initial equity, annual cash flow, and net sale proceeds equals zero", units: "%" },
      { metric: "Equity multiple", formula: "Positive levered distributions / total equity contributions", units: "multiple" },
      { metric: "NPV", formula: `Discounted levered cash flows at ${(assumptions.discountRate * 100).toFixed(1)}%`, units: "USD" },
      { metric: "Required reserves", formula: "Absolute value of the greatest cumulative pre-tax operating cash shortfall before sale", units: "USD" },
      { metric: "Exit value adjustment", formula: "Base exit valuation × (1 + explicit exit-value adjustment)", units: "USD" },
    ],
    warnings,
  };
}
