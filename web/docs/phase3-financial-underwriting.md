# Phase 3 financial underwriting

Calculation version: `nii-underwriting-v1.1.0`

## Scope

Phase 3 adds a private, versioned underwriting workbench for acquisition, financing, income,
operating expense, debt-service, and exit assumptions. It produces five- or ten-year pre-tax
projections, return metrics, scenario comparisons, one-variable stress tests, and spreadsheet-safe
CSV exports.

No external API key is required. A property may seed the model only with facts present in the
user-authorized property record. Missing facts retain visible system-default labels until the user
changes them.

## Input precedence

1. `user-override`: explicitly edited in the workbench.
2. `property-observed`: present in the linked private property record.
3. `neighborhood-estimate`: reserved for a labeled, validated future linkage.
4. `system-default`: a visible starting value that must be reviewed.

The application never converts a missing value into an observed fact. Scenario overrides are stored
separately from base assumptions, and every save creates an immutable model version.

## Formula contract

- Effective gross income = gross potential income - vacancy and credit loss.
- Year-one lease-up loss = gross potential income × lease-up months / 12.
- Operating expenses = grown fixed expenses + management and maintenance percentages.
- NOI = effective gross income - operating expenses.
- Pre-tax cash flow = NOI - capital reserves - debt service.
- Cap rate = year-one NOI / offer price.
- Cash-on-cash return = year-one pre-tax cash flow / initial cash invested.
- DSCR = year-one NOI / annual debt service.
- LTV = loan amount / offer price.
- LTC = loan amount / total acquisition cost.
- Gross rent multiplier = offer price / annual base rent.
- Break-even occupancy = (operating expenses + debt service + reserves) / gross potential income.
- Levered IRR uses initial and subsequent equity contributions, annual cash flow, and net sale
  proceeds.
- Equity multiple = positive levered distributions / total equity contributions.
- NPV discounts levered cash flows at the entered discount rate.

Debt amortizes monthly. An interest-only period pays monthly interest before scheduled amortization.
The loan term must cover the projection because refinancing is not silently assumed.

Exit value uses either:

- offer price compounded by the appreciation assumption, or
- next-year NOI divided by the exit cap rate.

Selling costs and the remaining loan balance are deducted from sale proceeds.
An explicit exit-value adjustment can stress either exit method without changing the base valuation
formula. Required reserves equal the greatest cumulative operating cash shortfall before sale.

## Guardrails and limitations

- Rates are stored as decimals and constrained to zero through one.
- Vacancy plus credit loss must remain below 100%.
- Exit cap rate must be positive when that valuation method is selected.
- Taxes, depreciation, refinancing, and after-tax proceeds are excluded.
- The initial release models aggregate property income, not per-unit rent rolls.
- Market rent, price, and exit inputs remain assumptions rather than appraisals or forecasts.
- Stress presets vary one base input at a time; they do not assign probabilities.

## Persistence

D1 stores the model record, immutable assumption versions, scenario overrides, calculation version,
and saved result snapshot. All operations are scoped to the forwarded authenticated user email.
Deleting a model removes its scenario snapshots and version history before removing the model.
