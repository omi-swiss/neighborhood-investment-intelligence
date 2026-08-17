import type { Metadata } from "next";
import { OpportunityScreener } from "./components/OpportunityScreener";
import dataset from "./data/areas.generated.json";
import { filtersFromSearch } from "./lib/screener-query";
import type { AreaDataset } from "./lib/types";

export const metadata: Metadata = {
  title: "Discover Markets",
  description:
    "Define an investor buy box and compare explainable neighborhood opportunities with map context and visible data confidence.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: Props) {
  const typedDataset = dataset as AreaDataset;
  const values = await searchParams;
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value) && value.length) query.set(key, value[0]);
  });
  return (
    <OpportunityScreener
      coverage={typedDataset.coverage}
      markets={typedDataset.markets}
      initialFilters={filtersFromSearch(query)}
    />
  );
}
