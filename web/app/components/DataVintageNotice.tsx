import Link from "next/link";
import type { Coverage } from "../lib/types";

export type DataVintageItem = {
  label: string;
  value: string;
  note?: string;
};

function coreItems(coverage: Coverage): DataVintageItem[] {
  return [
  {
    label: "Core tract metrics",
    value: `ACS ${coverage.scoreReferenceYear} 5-year`,
    note: `Trend comparisons use the ACS ${coverage.trendStartYear} and ${coverage.scoreReferenceYear} releases.`,
  },
  {
    label: "Map boundaries",
    value: `${coverage.geographyVintage} Census tracts`,
  },
  ];
}

export function DataVintageNotice({
  items = [],
  includeCore = true,
  coverage,
}: {
  items?: DataVintageItem[];
  includeCore?: boolean;
  coverage?: Coverage;
}) {
  const displayedItems = includeCore && coverage ? [...coreItems(coverage), ...items] : items;

  return (
    <aside className="data-vintage-notice" aria-label="Data vintage and freshness">
      <div className="data-vintage-heading">
        <div>
          <strong>Data vintages</strong>
          <span>Sources update on different schedules; years below are not assumed to match.</span>
        </div>
        <Link href="/sources#data-vintage-register">Full data-year register</Link>
      </div>
      <div className="data-vintage-items">
        {displayedItems.map((item) => (
          <div className="data-vintage-item" key={`${item.label}:${item.value}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.note ? <small>{item.note}</small> : null}
          </div>
        ))}
      </div>
    </aside>
  );
}
