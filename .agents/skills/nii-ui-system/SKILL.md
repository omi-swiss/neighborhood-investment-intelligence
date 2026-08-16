---
name: nii-ui-system
description: Improve the Neighborhood Investment Intelligence React interface, including maps, screen layouts, controls, responsive behavior, accessibility, and Tailwind CSS usage. Use for changes in web/app components or globals.css, especially opportunity-screen, property-marketplace, signals, and underwriting UX work.
---

# NII UI System

Build a calmer, faster investor interface without erasing the product's established visual identity.

## Start here

1. Read `docs/ui-registry.md`.
2. Inspect the affected component and its selectors in `web/app/globals.css`.
3. Confirm the user task, primary workflow, viewport constraints, and data states.
4. Read `references/map-and-responsive-checklist.md` for map or layout changes.

## Hybrid CSS and Tailwind policy

NII already uses Tailwind CSS 4 through `@import "tailwindcss"`, while most established components use semantic classes and CSS variables.

- Keep `:root` brand and surface variables authoritative.
- Preserve stable semantic selectors for complex components and map behavior.
- Use Tailwind utilities for new responsive composition, spacing, sizing, overflow, focus, and state styling when the class list stays readable.
- Reference existing variables from utilities when needed, for example `bg-[var(--surface)]` or `text-[var(--ink-muted)]`.
- Extract repeated utility strings into a component; do not scatter copies across pages.
- Avoid arbitrary values unless the value represents a real layout constraint and is documented.
- Do not use `@apply` to recreate long component styles or perform a wholesale semantic-CSS migration.

## Map experience

- Make the primary map visible on initial desktop load and useful in map-only, split, and table modes.
- Let market selection fit the chosen city and surrounding context without hiding all neighboring geography.
- Synchronize selected geography with the corresponding table row and accessible details.
- Provide city/downtown/landmark orientation without requiring hover.
- Keep hover supplementary. Selected state must work with keyboard and touch.
- Prefer one SVG scene and delegated interactions over per-feature components or listeners.
- Memoize geometry and labels; limit visible annotations by zoom and collision risk.
- Avoid continuous animation and respect `prefers-reduced-motion`.

## Interaction and layout

- Design mobile-first, then verify compact desktop, standard desktop, and wide layouts.
- Prevent input overlap with `minmax(0, 1fr)`, `min-width: 0`, sensible control heights, and wrapping at content-driven breakpoints.
- Keep controls at least 44 by 44 CSS pixels when practical; never shrink accessible names or focus targets to solve density.
- Include loading, empty, error, selected, disabled, and stale-data states.
- Use semantic HTML and visible labels. Icon-only controls require accessible names.
- Avoid hover-only definitions or clipped tooltips. Portals or top-layer patterns are preferred for overlays crossing panel boundaries.

## Finish

1. Verify keyboard navigation, focus visibility, zoom at 200%, reduced motion, and responsive widths.
2. Check the map/table state flow and rendering cost for map changes.
3. Run focused lint/build or rendered tests proportional to the change.
4. Use the `imprint` skill when the work establishes a reusable pattern.
