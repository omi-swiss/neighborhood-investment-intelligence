# Phase 4 comparables and advanced signals

## Comparable evidence contract

Phase 4 keeps comparable evidence separate from marketplace listings. Comparable records must be
explicitly identified as:

- `sale`, with a positive closed `sale_price`; or
- `rental`, with a positive observed `monthly_rent`.

Every record includes a source record ID, transaction date, source name, permission basis, and
observation date. Active listing asking prices are not converted into closed sales.

The blank contract is available at `/api/comparables/template`. The validation endpoint rejects
missing transaction facts before a D1 write. The private import endpoint accepts at most 500 records
per request and upserts only within the authenticated user's source namespace.

## Matching and adjustments

Automatic selection evaluates:

- geographic proximity, same ZIP, or same tract;
- property type;
- unit-count difference;
- building-size tolerance;
- year-built tolerance; and
- transaction recency.

Users can require the same tract/property type, change radius and recency, manually include or
exclude a record, and add a percentage adjustment plus a note. Decisions are stored by subject
property and comparable record.

Comparable values use this adjustment hierarchy:

1. scale by subject/comparable building square footage;
2. otherwise scale by unit count;
3. otherwise retain the observed transaction value; and
4. apply the explicit manual percentage adjustment.

The estimate is the median included adjusted value. The displayed low/high range is the 25th and
75th percentile. It is descriptive dispersion, not a statistical or appraisal confidence interval.
Confidence is labeled from the included count and average matching score.

## Advanced underwriting signals

Calculation version `nii-underwriting-v1.1.0` adds:

- explicit year-one lease-up months and lease-up loss;
- explicit exit-value adjustment;
- required operating cash reserves;
- first projected year with negative pre-tax cash flow;
- ten one-variable stress presets;
- six two-variable, five-by-five sensitivity matrices; and
- return-driver ranking across defined low/high shocks.

Sensitivity matrices support offer price/rent, interest rate/offer price, vacancy/rent growth,
renovation/exit value, exit cap/rent growth, and down payment/interest rate. Cells recalculate the
same deterministic financial model. Driver spreads indicate model dependence on the selected shock
range; they are not probabilities or forecasts.

## Limitations

- The application does not source comps from restricted sites.
- It does not infer concessions, condition adjustments, or transaction terms.
- Missing coordinates or property facts reduce matching evidence rather than being imputed.
- Comparable output is research support, not a broker price opinion or formal appraisal.
- Sensitivity and stress outputs remain pre-tax and inherit the Phase 3 model limitations.
