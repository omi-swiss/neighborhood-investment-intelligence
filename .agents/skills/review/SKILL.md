---
name: review
description: Review Neighborhood Investment Intelligence code, data, and UI changes for correctness and evidence integrity. Use for pre-commit review, pull-request review, data-release review, or before an approved deployment.
---

# Review

Review the change, not the author's intent. Lead with actionable findings ordered by severity.

## Review sequence

1. Inspect the diff and affected contracts. Ignore unrelated existing changes.
2. Check correctness, error handling, security, privacy, and backward compatibility.
3. For data changes, verify source, date/vintage, geography, units, null handling, status, and confidence/completeness.
4. For scoring or forecasts, verify deterministic inputs, documented assumptions, and labels that distinguish modeled values from observations.
5. For web changes, check keyboard use, focus, contrast, responsive layouts, loading/empty/error states, and map/table synchronization.
6. For maps, check initial viewport, city focus, selection persistence, readable non-hover context, and rendering cost.
7. Run only the focused checks needed to substantiate findings.

## Output

- List findings first with severity, file, and a concise impact statement.
- Distinguish confirmed defects from questions or optional improvements.
- If there are no actionable findings, say so and name any validation gap.
- Do not silently modify files during a review-only request.
