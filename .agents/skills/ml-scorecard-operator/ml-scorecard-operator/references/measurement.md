# Measurement guide

Choose measures from the model's output and decision.

| Situation | Primary measures | Decision checks |
| --- | --- | --- |
| Binary probability | PR-AUC for rare positives; ROC-AUC for general ranking | precision/recall, lift, confusion matrix, calibration, expected cost at threshold |
| Multi-class | macro/weighted F1, log loss | per-class recall, confusion matrix, calibration |
| Regression/forecast | MAE for typical absolute error; RMSE for large-error sensitivity; MAPE only with nonzero stable denominators | residuals by time/segment, bias, prediction intervals, forecast value |
| Ranking/prioritization | precision@k, recall@k, lift@k, NDCG | capacity at k, incremental outcome vs baseline |

## Calibration

For probability score `p`, a well-calibrated band near 0.30 should realize an outcome rate near 30%. Inspect reliability plots, Brier score, and calibration by material segment. Calibrate on a validation period, not training data. Revalidate after any distribution, model, or label-definition change.

## Threshold selection

Calculate a threshold table over realistic operating thresholds. Include selected population count, true/false positives, true/false negatives, precision, recall, and estimated benefit/cost. If capacity is fixed, choose `top k` and monitor performance at `k`; do not imply it is a universal probability threshold.

## Drift measures

Monitor inputs, score output, and relevant segment composition. Use stable bins and compare a current window with an approved reference. PSI can flag distribution shifts, but it is sensitive to binning and volume; pair it with missingness, data-quality checks, and outcome metrics once labels arrive. Investigate material shifts before retraining.

## Delayed labels

Separate the score-date cohort from its eventual outcome date. Report only matured cohorts for labeled performance, state the maturation rule, and maintain leading indicators for recent cohorts. Never treat absence of a delayed outcome as a confirmed negative without a justified censoring policy.
