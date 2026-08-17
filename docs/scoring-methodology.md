# Scoring and calculation methodology

## Purpose and boundary

Neighborhood Investment Intelligence uses transparent, deterministic screening
indices. They are **not** appraisals, investment recommendations, credit
decisions, or machine-learning predictions of investment return.

The area-level scores answer one narrow question: *how does a Census tract rank
against the currently supported city-proper tract cohort on the observed and
derived factors selected by the user strategy?* They do not predict a property's
future rent, value, cash flow, default risk, legal obligations, or environmental
condition.

The source-of-truth implementation is `scripts/export_web_phase1.py`. The web
application only reweights already exported component values when a user selects
a strategy.

## Scope, data, and timing

- **Unit:** 2020 Census tract.
- **Cohort:** the configured `opportunity_cohort_city_geoids` city-proper
  markets. Metro areas are shown as context only and are not silently used in
  the city score.
- **Core source:** U.S. Census Bureau ACS 5-year estimates.
- **Current scoring window:** ACS 2020 to ACS 2024. These are overlapping
  five-year survey windows, so changes are directional screening evidence, not
  independent annual observations.
- **Money values:** income, rent, and home value are adjusted to the configured
  inflation reference year before the derived growth and yield calculations.
- **Geometry:** analytical metrics use 2020 Census tract geography. A newer
  display boundary may be rendered only when its vintage is explicitly shown.

Each exported area retains source period, geography, coverage, and reliability
metadata. A missing value remains unavailable; it is never imputed into a
score.

## Component scores

All six exported components are bounded from 0 to 100. For each input, NII uses
an average-rank percentile within the active tract cohort:

```text
favorable-high percentile = average-rank percentile × 100
favorable-low percentile  = 100 - average-rank percentile × 100
```

Percentiles are relative ranks, not percentages of return or probabilities.
A value of 80 means the tract is around the 80th percentile of the configured
cohort for that component's inputs.

| Component | Formula | Favorable direction | Interpretation |
| --- | --- | --- | --- |
| Demographic momentum | Percentile of population CAGR from 2020 to 2024 | Higher | Observed population change relative to the cohort. |
| Income momentum | Percentile of real median-household-income CAGR from 2020 to 2024 | Higher | Observed real income change relative to the cohort. |
| Rental-market strength | `0.45 × gross-yield-proxy percentile + 0.25 × renter-share percentile + 0.30 × inverse rental-vacancy percentile` | Higher yield and renter share; lower vacancy | A screening composite, not a rent forecast or property NOI. |
| Housing demand | `0.55 × inverse rental-vacancy percentile + 0.45 × occupied-housing-units percentile` | Lower vacancy and more occupied units | Aggregate tract demand evidence; it does not establish demand for a specific unit type. |
| Economic resilience | `0.50 × inverse poverty-rate percentile + 0.50 × inverse unemployment-rate percentile` | Lower poverty and unemployment | Economic context only; it is not a complete property, climate, insurance, crime, or legal-risk score. |
| Data completeness | `metric_coverage × 100` | Higher coverage | Evidence availability, not investment upside. It remains visible for traceability. |

Derived input formulas:

```text
population CAGR = (population_2024 / population_2020)^(1 / 4) - 1
income CAGR     = (real_income_2024 / real_income_2020)^(1 / 4) - 1
gross yield proxy = real_median_monthly_gross_rent_2024 × 12
                    / real_median_home_value_2024
```

The gross-yield proxy uses area medians. It excludes operating expenses,
financing, taxes, insurance, repairs, capital reserves, property condition, and
transaction costs; it must not be presented as cap rate, cash-on-cash return,
or NOI yield.

## Opportunity score and user strategies

The default **Balanced opportunity** score is a weighted mean of the exported
components:

```text
0.15 × demographic momentum
+ 0.20 × income momentum
+ 0.25 × rental-market strength
+ 0.15 × housing demand
+ 0.15 × economic resilience
+ 0.10 × data completeness
```

The built-in strategies use the following transparent weights:

| Strategy | Demographic | Income | Rental market | Housing demand | Economic resilience | Data completeness |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced opportunity | 15% | 20% | 25% | 15% | 15% | 10% |
| Rental cash flow | 8% | 12% | 42% | 15% | 13% | 10% |
| Emerging neighborhood | 27% | 28% | 18% | 12% | 5% | 10% |
| Low-risk rental income | 8% | 12% | 20% | 18% | 30% | 12% |

When a component is unavailable, its weight is excluded and the remaining
available component weights are renormalized. The score explanation must show
the missing factor rather than treating it as zero. Strategy weights alter the
ranking only; they do not alter the observed source metrics.

There is no trained target variable, time-split backtest, calibration curve, or
probability interpretation. A predictive score would require a pre-defined
outcome (for example, verified realized property cash flow over a stated
horizon), point-in-time features, and out-of-time validation before it could be
claimed as more than a screening index.

## Other score-like displays

These are display summaries of the components above, not independent models:

| Display | Calculation | Important limitation |
| --- | --- | --- |
| Area fundamentals | Simple average of demographic momentum, income momentum, rental-market strength, housing demand, and economic resilience | A tract-level summary; it is not a city or metro “market quality” rating. |
| Rental-market conditions | Simple average of rental-market strength and housing demand | Vacancy appears in both inputs, so it is not independent confirmation. |
| Rental-economics composite | Rental-market-strength component | It is not an appraisal, valuation, or property price score. |
| Economic-risk label | `Low` at resilience >= 70; `Moderate` at >= 45; otherwise `Elevated` | Covers only poverty and unemployment inputs. |

## Data confidence

**Data confidence** is a quality classification, kept separate from investment
factors. It uses both metric completeness and ACS estimate reliability:

| Result | Rule |
| --- | --- |
| High | At least 90% metric completeness and no caution/unreliable population or income estimate. |
| Medium | 72%–89.9% completeness, or either population or income reliability is `caution`. |
| Low | Less than 72% completeness, or either population or income reliability is `unreliable`. |
| Missing | Completeness is unavailable. |

Reliability is derived from ACS margins of error using configured relative-MOE
thresholds: `caution` at 20% and `unreliable` at 40%. Confidence describes the
quality of the available evidence; it does not make a tract more investable.

## Policy, landlord operating environment, and physical risk

NII does **not** create a universal policy, landlord-friendliness, flood,
environmental, or insurance-risk score. Those topics vary by jurisdiction,
property type, and source coverage, and collapsing them into one number would
overstate precision.

- Regulatory records are displayed by policy dimension with official citation,
  effective date, verification status, and confidence.
- Environmental and insurance observations remain source-native individual
  factors with geography, vintage, assignment method, and confidence.
- Project and investment signals retain primary-source status and verification
  metadata. An announcement stays `ANNOUNCED` until primary evidence supports a
  change.

An unavailable policy or risk layer is shown as unavailable; it is not treated
as favorable or unfavorable.

## Financial underwriting calculations

Financial underwriting outputs are scenario calculations from explicit property
assumptions, not scores. Inputs are labelled as user overrides, observed
property values, neighborhood estimates, or system defaults.

```text
effective gross income = gross potential income - lease-up loss
                         - vacancy and credit loss
NOI = effective gross income - operating expenses
cap rate = year-one NOI / offer price
cash-on-cash = year-one pre-tax cash flow / initial cash invested
DSCR = year-one NOI / annual debt service
LTV = loan amount / offer price
LTC = loan amount / total acquisition cost
break-even occupancy = (operating expenses + debt service + reserves)
                         / gross potential income
NPV = sum(levered cash flow_t / (1 + discount rate)^t)
IRR = rate that makes NPV of levered cash flows equal zero
equity multiple = positive levered distributions / total equity contributions
```

Exit value is either explicit appreciation from the offer price or forward NOI
divided by the selected exit cap rate, plus any visible exit-value adjustment.
The model returns unavailable rather than a forced result where a denominator is
zero or the IRR root cannot be established. It warns when system-default inputs
remain, and it does not call modeled values appraisals.

## Governance and future validation

Every score release should retain the cohort, data vintage, formula/weight
version, metric coverage, input source, and artifact timestamp. Before changing
weights, the change should state its investor decision, expected effect, and
version. Before replacing a screening index with ML, define an observable
outcome and horizon, freeze point-in-time training data, use a time-based test
set, evaluate calibration and ranking at the real operating capacity, and
monitor missingness, distribution drift, and segment performance after release.
