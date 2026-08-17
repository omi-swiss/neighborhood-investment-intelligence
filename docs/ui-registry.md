# NII UI registry

This registry is the source of truth for reusable interface patterns. It documents the current implementation; it is not a mandate to rewrite existing CSS.

## Foundations

The canonical tokens are CSS variables in `web/app/globals.css`.

| Role | Token | Use |
| --- | --- | --- |
| Primary text | `--ink` | Headings, body text, strong data values |
| Secondary text | `--ink-muted` | Supporting labels, metadata, explanations |
| Page background | `--paper` | Application canvas |
| Standard surface | `--surface` | Panels, menus, cards |
| Raised surface | `--surface-strong` | Popovers and emphasized cards |
| Border | `--line` | Dividers and neutral component borders |
| Primary action | `--pine` | Active controls, links, selected states |
| Deep navigation | `--pine-deep` | Sidebar, footer, strong contrast surface |
| Positive context | `--mint` | Supportive and low-intensity status fills |
| Accent | `--gold` / `--gold-soft` | Focus, evidence, investment, and highlights |
| Warning/error | `--warning` / `--danger` | Risk and destructive feedback |

Do not add raw brand colors to JSX when an existing token expresses the role. Tailwind utilities may reference these variables directly.

## Styling strategy

NII uses a hybrid system:

- Semantic classes remain canonical for established components, dense data views, SVG map behavior, and cross-page patterns.
- Tailwind 4 utilities are appropriate for new layout composition, responsive changes, sizing, overflow, focus, and simple states.
- Repeated utility groups should become a component or a documented semantic pattern.
- A visual-only migration from semantic CSS to utilities is not valuable by itself.

## Application shell

Canonical locations: `AppNavigation.tsx`, `PageShell.tsx`, and `.app-shell`, `.side-nav`, `.topbar`, `.page` in `globals.css`.

- Desktop uses persistent navigation; compact desktop collapses labels; mobile uses bottom navigation.
- Main content must allow `min-width: 0` so tables, maps, and forms do not force page overflow.
- The skip link and `main-content` target are required.

## Controls and overlays

Canonical patterns include `.button`, `.field`, `.segmented`, `.market-combobox`, `.market-popover`, `.map-popup`, and `.metric-help-tip`.

- Use visible labels and predictable control heights.
- Popovers and tooltips must not be clipped by neighboring panels.
- Essential explanations must be available through focus/click, not hover alone.
- Loading, empty, error, selected, and disabled states are part of the component.

## Opportunity map

Canonical locations: `OpportunityMap.tsx`, `OpportunityScreener.tsx`, `.map-wrap`, `.map-svg`, `.map-area`, `.map-controls`, `.map-orientation-label`, and `.screener-split`.

- The map is the primary discovery surface and should be visible on initial desktop load.
- Split mode is intentionally asymmetric: the map receives more width than the result table.
- Market selection fits the selected city with surrounding geographic context.
- Clicking or keyboard-selecting a tract updates the same selected record used by the table and details.
- City, downtown, and limited landmark labels provide orientation without hover.
- Selected tracts use persistent visual treatment and accessible text; hover is supplementary.
- Geometry and label work should be memoized and annotation counts bounded.

### Market-atlas drill-down

When no city is selected, `OpportunityMap.tsx` renders a national market atlas rather than microscopic tract polygons. Each market marker names the city, reports its covered-tract count, and works by click, touch, Enter, or Space to apply that city filter. The selected city then renders the existing tract-level choropleth and visible county-coverage labels derived from the loaded tract records. County labels describe coverage only; the product does not claim to render standalone county boundaries unless that geometry is supplied.

The atlas and tract map share the same SVG scene. `map-market` is the keyboard-operable market target; `map-county-label` is supplementary, non-interactive context. A native non-passive wheel listener plus `overscroll-behavior: contain` keeps wheel zoom within the map, while drag and touch stay map-local through `touch-action: none`. Keep the textual table as the equivalent selection path and do not reintroduce a hover-only market action.

The screener API keeps this interaction performant: the all-market atlas receives only derived market summaries, not tract geometry. A focused city map receives at most 1,200 matching tract records and visibly discloses when filters match more. Table rows remain paginated detailed records. Do not add an import of `areas.generated.json` to a client component; pass the small coverage or metadata fields it needs as props.

### Boundary-vintage disclosure

When current display boundaries differ from the geography used by an analytical metric, the map note must identify both rather than silently substituting geometry. The display artifact contains geometry only and is keyed by stable tract GEOID; the metric artifact retains its own geography vintage and values. `OpportunityMap.tsx` renders the disclosure through `.map-note`, including mixed-coverage wording when a display vintage is available for only some markets. It is ordinary readable text, remains visible at narrow widths and 200% zoom, and introduces no hover-only explanation or new interactive target. Loading state may temporarily replace the layer label but must not remove the metric-geography statement.

### Display-geometry scope

The opportunity-screen display artifact contains only the configured city-proper cohort, not every tract in the states loaded into the warehouse. `opportunity_cohort_city_geoids` in `config/default.yaml` is the canonical scope; `export-display-geography-web` applies it by default through `export_display_geography_web_payload`. This keeps client map geometry bounded while preserving the same GEOID-based 2025 display / 2020 metric-vintage disclosure. Use `--all-loaded-tracts` only for an explicitly separate non-screener artifact; it is not suitable for the opportunity screen bundle.

## Dense forms and underwriting

Use content-driven grids with `minmax(0, 1fr)` and `min-width: 0`. Controls may be compact but cannot overlap, clip values, or shrink focus targets below practical usability. Definitions for financial terms must work by keyboard and remain visually subordinate to the metric.

## Tables

Tables are an accessible equivalent to spatial views, not secondary decoration. Headers expose sort direction, selected rows are persistent, and horizontal scrolling stays inside the table container. Map selection should reveal the corresponding row without changing unrelated filters.

## Accessibility baseline

Target WCAG 2.2 AA: semantic landmarks, keyboard operation, visible focus, 4.5:1 normal text contrast, 3:1 non-text contrast, accessible names, programmatic labels, 200% zoom support, and reduced motion. Record audit evidence before making a legal-compliance claim.
