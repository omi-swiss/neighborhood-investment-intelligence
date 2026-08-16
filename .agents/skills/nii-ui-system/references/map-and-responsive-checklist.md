# Map and responsive checklist

## Opportunity screener

- Default desktop view exposes the map without scrolling on a typical 768-900 px-tall viewport.
- Map-only mode uses most of the available viewport; split mode gives the map more width than the table.
- City selection fits the selected market plus a modest context buffer and does not retain the prior city's transform.
- Clicking a geography selects, focuses, and reveals its table row or an equivalent accessible detail panel.
- Table selection updates the map with the same canonical tract ID.
- Neighborhood label, county, city/state, and tract ID remain distinguishable.
- Downtown/city orientation labels remain readable and do not obscure the selected tract.

## Performance

- Derive geometry and market centers with memoization.
- Avoid state updates on every pointer movement when a request-animation-frame or stable hover target suffices.
- Avoid mounting detail panels, observers, or event listeners per tract.
- Use vector-effect and SVG transforms instead of recomputing path geometry during zoom.
- Keep annotation count bounded and progressively disclose detail.
- Test with the largest supported market, not only Washington, DC.

## Accessibility

- Every map action has a keyboard and touch path.
- Selected state is conveyed by more than color.
- A tabular or textual equivalent exists for map content.
- Focus order follows the visible workflow.
- Tooltips are not clipped and do not contain essential hover-only content.
- Normal text targets 4.5:1 contrast; non-text controls and focus indicators target 3:1.
- Animations and smooth scrolling respect reduced-motion preferences.

## Responsive checks

Verify at approximately 360, 768, 1024, 1280, and 1536 CSS pixels, plus 200% browser zoom. Check horizontal overflow, sticky/fixed navigation, form control overlap, map height, table usability, and overlay containment.
