# Neighborhood Investment Intelligence project guidance

## Mission

Build an evidence-first real-estate intelligence product. Preserve the distinction between observed facts, estimates, forecasts, and incomplete coverage. Optimize for investor usefulness without overstating data quality.

## Read first

Before changing code or data, read the relevant portions of:

- `README.md`
- `docs/architecture.md`
- `docs/data_sources.md`
- `docs/ui-registry.md` for web or design work
- `docs/operations.md` or `docs/runbook.md` for pipeline work

## Non-negotiable data rules

- Never commit API keys, credentials, private contact data, or `.env` files.
- Keep source URL, observation period, geography, retrieval date, and confidence/completeness metadata with every metric when the schema supports them.
- Keep announcements as `ANNOUNCED` until primary evidence supports a status change.
- Do not present public parcel records as active listings.
- Do not fill missing values with invented facts. Label modeled estimates and forecasts explicitly.
- Preserve reproducibility: deterministic calculations, versioned assumptions, and stable geography identifiers.

## Web and UI rules

- The web app is React + TypeScript with Tailwind CSS 4 and semantic CSS in `web/app/globals.css`.
- Treat the existing CSS variables and documented semantic patterns as the visual source of truth.
- Use Tailwind incrementally for responsive layout, spacing, state, and accessibility when it is clearer than adding a one-off selector. Do not rewrite working screens solely to convert CSS styles into utilities.
- Keep maps useful without hover: provide selected-state details, visible orientation labels, keyboard operation, and synchronized map/table selection.
- Protect map performance. Avoid a separate React component, listener, or expensive effect for every tract when one delegated or SVG-level interaction will work.
- Meet WCAG 2.2 AA targets for contrast, focus, names, labels, keyboard use, and reduced motion. Compliance claims require an actual audit; code alone cannot guarantee legal compliance.

## Working method

- Preserve unrelated user changes and inspect `git status` before editing.
- Prefer the smallest coherent change. Use a review branch for material changes.
- Run focused validation proportional to risk. Do not run the full data pipeline for documentation-only or agent-configuration changes.
- Never deploy or publish without explicit user approval for that deployment.
- Use subagents only for bounded, independent work. Keep write-heavy work with one owner to avoid conflicts.

## Project skills

- `architect`: plan consequential product, data, or architecture changes.
- `imprint`: record a reusable UI pattern after a visual change.
- `nii-ui-system`: implement NII UI, responsive, accessibility, and map improvements with the hybrid CSS/Tailwind approach.
- `review`: perform an evidence-first code and data review.
- `recover`: safely resume or repair incomplete work without destructive resets.
- `remember`: capture stable local project decisions without secrets.

Project agents live in `.codex/agents/`. Choose the narrowest agent for the task and review its output before applying changes.
