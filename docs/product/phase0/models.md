# Analytical model specifications

## Shared calculation rules

- Store input values in explicit base units; format only at presentation.
- Use decimal arithmetic for money and ratios whose rounding affects decisions.
- Persist full precision; round currency to cents and displayed percentages to configured precision.
- Return `null` with a reason code when a denominator is zero or required input is missing.
- Every output records calculation version, input version, timestamp, units, and lineage.
- Observed, user-entered, comparable-estimated, area-estimated, and system-default values remain
  distinguishable.

## Assumption hierarchy

Resolve each assumption in this order:

1. User override
2. Property-specific observed value
3. Comparable-property estimate
4. Neighborhood estimate
5. City or metro default
6. Explicit system default

The resolved value includes `source_level`, `source_record_id`, `observed_at`, `confidence`, and
`is_override`. A missing higher-priority value is not silently materialized; the resolution trace
lists each attempted level. System defaults require a visible acknowledgement in detailed models.

## Financial model

### Acquisition and debt

```text
total_acquisition_cost =
  offer_price + closing_costs + inspection_costs + legal_costs + financing_fees
  + initial_reserves + renovation_budget + furnishing_budget

loan_amount = min(explicit_loan_amount, offer_price × LTV limit, total_cost × LTC limit)
cash_invested = total_acquisition_cost - loan_proceeds + funded_loan_reserves

monthly_rate = annual_interest_rate / 12
period_count = amortization_years × 12
monthly_payment =
  principal × monthly_rate × (1 + monthly_rate)^period_count
  / ((1 + monthly_rate)^period_count - 1)
```

For a zero rate, payment is principal divided by periods. Interest-only periods pay
`outstanding_principal × monthly_rate`; balloon and refinance events use the amortization schedule,
not an approximate balance.

### Income and operations

```text
gross_potential_rent = sum(unit_market_or_contract_rent × rentable_months)
gross_potential_income = gross_potential_rent + other_potential_income
vacancy_and_credit_loss = gross_potential_income × (vacancy_rate + credit_loss_rate)
effective_gross_income =
  gross_potential_income - vacancy_and_credit_loss - concessions + reimbursements
operating_expenses = sum(resolved operating expense lines)
NOI = effective_gross_income - operating_expenses
pre_tax_cash_flow = NOI - debt_service - non_operating_capital_items
```

Debt service, depreciation, income tax, capital improvements, and owner distributions are not
operating expenses. HOA and ordinary recurring replacement reserves are included according to the
model policy and labeled.

### Core metrics

```text
going_in_cap_rate = year_1_NOI / purchase_price
stabilized_cap_rate = stabilized_NOI / total_project_cost
cash_on_cash = annual_pre_tax_cash_flow / initial_cash_invested
DSCR = NOI / annual_debt_service
LTV = loan_amount / appraised_or_purchase_value_basis
LTC = loan_amount / total_project_cost
operating_expense_ratio = operating_expenses / effective_gross_income
GRM = purchase_price / annual_gross_scheduled_rent
break_even_occupancy =
  (operating_expenses + debt_service - non_rent_income) / gross_potential_rent
rent_needed_to_break_even =
  (operating_expenses + debt_service - other_income) / collectible_unit_months
return_on_cost = stabilized_NOI / total_project_cost
```

The value basis for LTV is explicit. Ratios return no result when the denominator is non-positive.

### Projection and terminal value

At least ten annual rows include rent, other income, vacancy, every expense category, capital
expenditures, NOI, debt principal/interest, cash flow, loan balance, and source assumptions.

```text
terminal_value = next_year_NOI / exit_cap_rate
net_sale_proceeds =
  terminal_value - selling_costs - remaining_loan_balance - modeled_sale_taxes
unlevered_cash_flows =
  [-total_project_cost, annual_NOI - capex..., terminal_value less selling costs]
levered_cash_flows =
  [-cash_invested, annual_pre_tax_cash_flow..., net_sale_proceeds]
NPV = sum(cash_flow_t / (1 + discount_rate)^t)
IRR = rate where NPV equals zero
equity_multiple = total_positive_equity_distributions / total_equity_contributions
total_profit = total_distributions - total_contributions
```

IRR may have no unique solution for non-conventional cash flows; return `null` plus
`IRR_NOT_UNIQUE` rather than a misleading value. After-tax outputs exist only when sufficient,
explicit tax assumptions are provided and remain research estimates.

### Scenarios, sensitivities, and stress

A model has immutable versions. Each version can have base, conservative, optimistic, and custom
scenario assumption deltas. Sensitivity runs form a bounded matrix over two inputs and preserve the
base model/version. Stress tests report cash flow, DSCR, IRR, reserves consumed, and first negative
cash-flow year for rate, rent, vacancy, tax, insurance, renovation, lease-up, exit price/cap, and
regulatory shocks.

## Area scoring methodology

### Principles

- Category scores remain primary; a composite is optional and never shown without components.
- Metric definitions specify unit, favorable direction, cohort, transform, winsorization, weight,
  minimum coverage, exclusions, and version.
- Rank only against an explicit comparable cohort and date/release.
- Do not replace source-native geography with more granular labels.

### Normalization

For each metric and cohort:

1. Exclude values failing the metric's validity rule, without dropping the area from other metrics.
2. Winsorize at versioned cohort percentiles (default 2nd/98th) only for scoring; preserve the raw
   value.
3. Calculate percentile rank. For unfavorable-high metrics, use `1 - percentile`.
4. Convert to 0–100. Ties receive the average rank.
5. Attach cohort size and distribution date.

Robust z-scores may be used for diagnostics, but percentile scores are the default because they are
explainable and bounded. National, state, metro, and city percentiles are separate outputs.

```text
component_points = normalized_score × configured_weight
category_score =
  sum(component_points for available eligible metrics)
  / sum(configured_weight for available eligible metrics)
coverage = available_configured_weight / total_configured_weight
composite =
  weighted mean of eligible category scores - explicit risk penalties
```

The score is insufficient when coverage is below the strategy threshold (default 70%), a required
metric is missing, cohort size is below the configured minimum, or an exclusion rule applies.
Weights may be rescaled only among available eligible metrics and the UI must show the missing-data
effect. Reliability penalties and investment-risk penalties are separate.

### Versioned strategy contract

A strategy version contains category/metric weights, directions, cohorts, transforms, quality
thresholds, required metrics, exclusion rules, penalties, effective dates, author, and rationale.
Editing duplicates to a new immutable version. Saved results reference the exact version and data
release.

Suggested initial presets are templates requiring domain-owner review:
long-term appreciation, rental cash flow, value-add multifamily, emerging neighborhood, low-risk
rental income, transit-oriented investment, urban infill, affordable housing, and high-income
renter demand. A template is not active until its real input coverage is validated.

## Property favorability

Property favorability is a transparent, recalculating classification, not an appraisal:

- Highly favorable: score 80–100 and adequate coverage
- Favorable: 65–79.999
- Neutral: 45–64.999
- Unfavorable: 30–44.999
- Highly unfavorable: 0–29.999
- Insufficient data: quality/coverage/exclusion rule fails

Thresholds are versioned. Components may include comparable price discount/premium, price per
square foot, market rent, rent-to-price, GRM, cap rate, cash-on-cash, DSCR, break-even occupancy,
area trends/risks, taxes, insurance, regulation, renovation, and reliability. Financial components
use the selected saved scenario, never an invisible “best case.”

Each component returns:

```text
metric_id, raw_value, unit, benchmark_value, benchmark_method,
normalized_score, configured_weight, effective_weight, favorable_direction,
confidence, source_id, source_date, calculation_version, missing_data_effect
```

Confidence reflects source recency, comparable similarity/count, geographic fit, and data quality;
it is not blended invisibly into expected return.

## Comparable selection

Generate candidates using authorized sale/listing records, then filter/rank by:
geographic radius, same/adjacent tract or neighborhood, property type, units, size, age, condition,
and transaction date. Persist selection reason and similarity components. Users can include/exclude
items and add adjustment notes without altering source records.

Report median and robust range, adjusted indication, subject premium/discount, count, dispersion,
and confidence. Automated results are labeled market indications, not formal appraisals. No
comparable result exists until legally usable records are loaded.

## Model test oracle

Later implementation must include hand-calculated golden cases for zero-interest debt,
interest-only-to-amortizing debt, balloon/refinance, missing/zero denominators, unit-level income,
all expense modes, irregular IRR, terminal sale, scenario inheritance, percentile ties,
unfavorable directions, missing weights, penalties, and immutable replay.
