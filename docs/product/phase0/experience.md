# Experience specification

## Experience principles

- Begin with a decision, not a collage of KPI cards.
- Keep dates, units, source geography, quality, and estimate status beside the value.
- Let users move from summary to evidence without leaving context.
- Use one query state for search, filters, table, map, count, and export.
- Default to readable density on desktop and a focused review flow on mobile.
- Never encode favorable/unfavorable meaning by color alone.

## Opportunity Screener — desktop

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ NII   Search areas…                   As of 2026-07-26   Data health   User/Workspace │
├───────────────┬──────────────────────────────────────────────────────────────────────┤
│ OPPORTUNITY   │ Opportunity Screener                        Save filters   Export     │
│ Properties    │ [Metro: Washington…] [Strategy: Custom] [12 active filters]          │
│ Underwriting  ├────────────────────────────────┬─────────────────────────────────────┤
│ Watchlists    │ FILTERS (sticky)               │ MAP / TABLE toggle  Split view      │
│ Methodology   │ Geography                      │ ┌─────────────────────────────────┐ │
│ Settings      │ State [ ] Metro [ ] City [ ]  │ │ viewport-limited tract layer    │ │
│               │                                │ │ hover: name, score, key facts   │ │
│               │ Momentum                       │ │ click: selection + summary      │ │
│               │ Population growth [min][max]  │ └─────────────────────────────────┘ │
│               │ Income growth     [min][max]  │ 1–50 of 1,284  Sort: Rental strength│
│               │ Rent growth       [min][max]  │ ┌─────────────────────────────────┐ │
│               │                                │ │□ Area       Score Income Vacancy│ │
│               │ Risk                           │ │□ Tract A     72    +4.1%  4.8%  │ │
│               │ Crime trend       [       ]    │ │  Quality: caution • ACS 2024    │ │
│               │ Data quality      [       ]    │ │□ Tract B     69    +3.2%  5.1%  │ │
│               │                                │ └─────────────────────────────────┘ │
│               │ [Clear] [Apply]                │ [previous] 1 2 3 … [next]           │
└───────────────┴────────────────────────────────┴─────────────────────────────────────┘
```

Behavior:

- Applying filters updates the URL and debounces the canonical request; table and map receive the
  same normalized filter expression.
- Panning the map adds a viewport constraint only when “search this map area” is on.
- Selecting a table row highlights the same map feature; selecting the feature focuses the row.
- Score cells open a breakdown drawer. Quality/status badges have labels and tooltips.
- Unsupported metrics remain visible in the metric catalogue but are disabled in filters with a
  source/coverage explanation.

## Score explanation drawer

```text
┌───────────────────────────────────────────────────┐
│ Rental-market strength                  72 / 100  │
│ Metro percentile 81 • coverage 88% • model v1.0  │
├───────────────────────────────────────────────────┤
│ Metric          Value  Benchmark  Dir  Weight Pts │
│ Rent growth      4.2%     2.6%     ↑     30   24 │
│ Vacancy          5.1%     6.0%     ↓     30   19 │
│ Renter share    61.0%    49.0%     ↑     20   15 │
│ Rent burden     missing              —      —    │
├───────────────────────────────────────────────────┤
│ Missing-data effect: remaining weights rescaled   │
│ ACS 2024 5-year • released 2026-01-29 • caution   │
│ [Metric definitions] [Open area]                  │
└───────────────────────────────────────────────────┘
```

## Area detail — desktop

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Results  Tract 0012.03 • County, ST                 Save  Compare  View properties │
│ City context • Metro context • Tract geometry 2020 • latest mixed-vintage evidence  │
├──────────────────────────────┬───────────────────────────────────────────────────────┤
│ Summary & map                │ Strategy score 68 / 100                               │
│ [selected boundary]          │ [Momentum 74] [Rental 70] [Risk 55] [Quality 82]      │
│ Current values               │ Why: top drivers / penalties / missing components     │
├──────────────────────────────┴───────────────────────────────────────────────────────┤
│ Overview | Trends | Comparisons | Development | Risks | Sources                     │
│                                                                                      │
│ Median household income      [five-vintage chart]                                    │
│ $82,410 • observed • tract   City percentile 62 • Metro percentile 57               │
│ ACS 2024 • released …        Warning: overlapping ACS windows                        │
│                                                                                      │
│ [source and formula] [download observations]                                         │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Comparisons do not imply equal geography. Each peer line identifies cohort, geographic unit,
aggregation method, period, and coverage.

## Mobile area review

```text
┌─────────────────────────────┐
│ ‹ Results      Save   ⋯     │
│ Tract 0012.03, County, ST   │
│ [Summary] [Trends] [Data]   │
├─────────────────────────────┤
│ Strategy score 68           │
│ Coverage 82% • caution      │
│ [compact selected map]      │
│ Top drivers                 │
│ + Income momentum           │
│ + Rental strength           │
│ − Supply risk               │
│ Current values              │
│ Income       $82,410        │
│ Vacancy         5.1%        │
│ Updated/source labels       │
└─────────────────────────────┘
```

Mobile does not attempt full-width spreadsheet analysis. It prioritizes review, saving, notes, and
handoff to desktop comparison/underwriting.

## Empty, partial, and error states

| State | Required response |
|---|---|
| No query | Suggested supported metros and a search prompt |
| Zero results | Show active constraints; offer to clear one; never broaden silently |
| Metric unavailable | Disable filter and link to coverage/methodology |
| Partial coverage | Return result with quality badge and missing component explanation |
| Stale source | Show last successful date and expected refresh; retain prior verified release |
| Map unavailable | Keep accessible table usable and show request ID |
| API unavailable | Preserve filter state; offer retry; do not show cached values as current |
| Unauthorized | Sign-in or no-access view without revealing resource existence |

## Component hierarchy

```text
AppShell
├─ GlobalNavigation
├─ GlobalSearch
├─ AsOfControl
├─ DataHealthIndicator
└─ Route
   ├─ OpportunityScreenerPage
   │  ├─ ScreenerQueryProvider
   │  ├─ FilterPanel
   │  │  ├─ GeographyFilter
   │  │  ├─ MetricRangeFilter[]
   │  │  ├─ QualityFilter
   │  │  └─ StrategySelector
   │  ├─ ResultsToolbar
   │  ├─ SynchronizedResults
   │  │  ├─ AreaTable
   │  │  ├─ OpportunityMap
   │  │  └─ AreaSelectionSummary
   │  ├─ ScoreExplanationDrawer
   │  └─ SaveFilterDialog
   └─ AreaDetailPage
      ├─ AreaHeader
      ├─ AreaMap
      ├─ ScoreSummary
      ├─ MetricGrid
      ├─ TrendExplorer
      ├─ CohortComparison
      ├─ DevelopmentLayer
      ├─ SourceAndQualityPanel
      └─ SaveAreaAction
```

Page components compose feature components. Feature components call typed hooks. Hooks call API
clients. API DTOs are converted by view-model functions. Formatting, scoring, formulas, and SQL do
not live in components.

## State model

`ScreenerQuery` contains:

- `contextAreaId`, `levels[]`, `asOf`, `strategyVersionId`
- normalized `filters[]` with metric, operator, values, and units
- `sort[]`, `page`, `pageSize`, selected fields
- `viewport` and `viewportEnabled`
- `displayMetric`, map layers, and selected area

The URL is authoritative for durable view state. TanStack Query caches by a canonical serialized
query. Draft filter input stays local until apply. Saved filter sets store the validated canonical
query plus a schema version, not UI component state.

## Accessibility acceptance

- All operations are keyboard reachable with logical focus order and a visible focus indicator.
- Filter validation and asynchronous updates are announced appropriately.
- Map-only facts also appear in the table or selected-feature summary.
- Charts include a textual summary and accessible data table.
- Status uses text/icon plus color and meets WCAG 2.2 AA contrast.
- Touch targets are at least 44×44 CSS pixels on mobile.
- Motion respects reduced-motion preferences.
