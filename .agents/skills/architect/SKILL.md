---
name: architect
description: Plan consequential Neighborhood Investment Intelligence changes before implementation. Use for new data layers, cross-cutting product features, schema changes, scoring changes, integrations, or work that affects several pipeline and web components.
---

# Architect

Turn a broad request into an implementable NII plan while preserving evidence, geography, and product integrity.

## Workflow

1. Read the relevant project guidance and inspect the current implementation.
2. State the user outcome, in-scope systems, and explicit non-goals.
3. Trace the affected flow from source evidence through ingestion, normalization, scoring/export, API, and UI.
4. Identify data contracts, geographic keys, vintages, licensing constraints, and failure modes.
5. Propose the smallest architecture that supports the outcome and future market expansion.
6. Divide work into independently verifiable increments. Mark any step requiring a new credential, paid license, deployment approval, or user decision.
7. Define focused acceptance checks and rollback-safe boundaries.

## Required plan qualities

- Separate observed, estimated, forecast, and unavailable values.
- Preserve primary-source URLs and status semantics for investment evidence.
- Prefer configuration-driven market expansion over city-specific branches.
- Keep source-specific adapters behind normalized internal contracts.
- Include accessibility and map performance when the web experience changes.
- Avoid parallel writers to the same files or data artifacts.

Do not implement while using this skill unless the user also asks for implementation.
