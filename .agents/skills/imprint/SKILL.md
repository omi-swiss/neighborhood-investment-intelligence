---
name: imprint
description: Capture and reuse Neighborhood Investment Intelligence visual patterns. Use after establishing or changing a reusable component, layout, interaction, map behavior, design token, or accessibility convention.
---

# Imprint

Keep NII's interface coherent as it grows.

## Workflow

1. Read `docs/ui-registry.md` and the relevant implementation in `web/app/globals.css` and `web/app/components/`.
2. Decide whether the change is a one-off or a reusable pattern. Do not register incidental page-specific styling.
3. Reuse an existing token or component before introducing a new one.
4. If the pattern is new, document its purpose, anatomy, states, responsive behavior, accessibility behavior, and canonical implementation location in `docs/ui-registry.md`.
5. Record migration notes only when existing screens should adopt the pattern later.
6. Verify that documentation matches the implemented code.

## Guardrails

- Prefer semantic names tied to product meaning, not a single visual value.
- Keep CSS variables in `globals.css` authoritative for brand color and surface tokens.
- Tailwind utilities may compose layout and states, but must not create a second undocumented color or spacing system.
- Include focus, selected, loading, empty, error, and reduced-motion behavior where applicable.
