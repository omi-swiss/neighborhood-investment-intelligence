---
name: ml-scorecard-operator
description: Design, build, deploy, evaluate, and monitor production machine-learning scoring systems. Use for propensity, risk, fraud, churn, lead, ranking, forecasting, eligibility, or similar model scores; model selection and calibration; batch or real-time scoring; score tracking, drift detection, thresholding, and retraining plans.
---

# ML Scorecard Operator

Build decision-ready scores with an auditable lifecycle. Treat a score as a product: define who or what it scores, the decision it influences, how feedback arrives, and how performance will be monitored before choosing a model.

## Intake and framing

Establish the following before implementation. Ask only for missing items that materially change the design.

| Specify | Examples |
| --- | --- |
| Unit and cadence | customer, transaction, account; daily batch or API request |
| Prediction target and horizon | churn within 30 days; default within 12 months |
| Decision and action | prioritize outreach, route review, price, approve, investigate |
| Outcome availability | immediate label, delayed label, proxy, or no label yet |
| Cost of errors | false approval, missed fraud, wasted outreach, fairness impact |
| Constraints | latency, explainability, regulated use, privacy, intervention capacity |

Write the target as an observable event with a cutoff date. Split data by time whenever production will score future observations. Identify leakage explicitly: exclude features unavailable at the scoring timestamp, labels encoded in downstream fields, and post-decision data.

## Build the score

1. Establish a baseline first: rate-based, rules-based, linear, or last-value forecast as appropriate.
2. Create a reproducible feature contract: source, definition, freshness, null policy, allowed values, owner, and point-in-time availability for every feature.
3. Use a time-aware train/validation/test design; keep the newest untouched period as the primary estimate of production performance.
4. Choose metrics from the operational decision rather than a generic leaderboard. Use the metric guide in [references/measurement.md](references/measurement.md).
5. Calibrate probabilities when downstream decisions interpret a score as a likelihood. Check calibration by segment and score band.
6. Select thresholds using capacity and cost. Report expected volume, precision/recall, false-positive/false-negative counts, and value at each candidate threshold.
7. Produce interpretable outputs: score, score version, timestamp, top reason codes or approved explanations, and decision/threshold version. Do not expose feature importance as causal explanation.

Compare candidates with uncertainty where feasible (confidence intervals, bootstrapping, or backtests), stability across relevant segments, data/compute cost, and operational simplicity. Do not present an offline metric improvement as a business result without an experiment or causal design.

## Deploy safely

Choose the scoring pattern based on the decision window:

- Use batch scoring for scheduled prioritization, portfolio refreshes, and forecasts.
- Use real-time scoring only when an immediate decision requires it and feature freshness, latency, and fallback behavior are supportable.
- Use asynchronous scoring when an immediate response is not required but event-triggered freshness matters.

Version model artifact, code, training data snapshot or query, feature definitions, schema, calibration, threshold policy, and output contract together. Add validation for schema, ranges, missingness, duplicate IDs, point-in-time joins, and output bounds. Define a fallback (last known score, rules, manual review, or fail closed) and alert on scoring failures.

## Track score health

Create two monitoring layers.

**Before labels arrive:** job success, freshness, feature null/range changes, score distribution, prediction volume, segment mix, and drift versus the training or approved reference population.

**After labels arrive:** discrimination, calibration, precision/recall or error rates at the operating threshold, realized business value, and segment-level performance/fairness checks where relevant.

For every alert, define baseline, comparison window, threshold, owner, severity, and response. Investigate in this order: pipeline/data integrity, population shift, label delay or definition changes, calibration/threshold fit, then model degradation. Drift alone is a trigger for investigation—not automatic retraining.

## Deliverables

Unless the user asks otherwise, deliver:

1. A concise score specification: target, unit, horizon, use case, data cutoff, owner, and exclusions.
2. A modeling and validation plan with baseline, time splits, leakage controls, metrics, and threshold policy.
3. A scoring contract: inputs, outputs, cadence/latency, versioning, validation, and fallback.
4. A monitoring scorecard with leading and labeled metrics, segment cuts, alerts, and retraining criteria.
5. Assumptions, limitations, and the next decision needed from stakeholders.

Use domain language consistently: reserve **score** for the model output, **decision** for the action it drives, and **outcome** for the observed label.
