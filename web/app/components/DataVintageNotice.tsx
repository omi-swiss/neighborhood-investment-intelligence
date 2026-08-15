import Link from "next/link";
import dataset from "../data/areas.generated.json";

export type DataVintageItem = {
  label: string;
  value: string;
  note?: string;
};

const coreItems: DataVintageItem[] = [
  {
    label: "Core tract metrics",
    value: `ACS ${dataset.coverage.scoreReferenceYear} 5-year`,
    note: `Trend comparisons use the ACS ${dataset.coverage.trendStartYear} and ${dataset.coverage.scoreReferenceYear} releases.`,
  },
  {
    label: "Map boundaries",
    value: `${dataset.coverage.geographyVintage} Census tracts`,
  },
];

export function DataVintageNotice({
  items = [],
  includeCore = true,
}: {
  items?: DataVintageItem[];
  includeCore?: boolean;
}) {
  const displayedItems = includeCore ? [...coreItems, ...items] : items;

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
