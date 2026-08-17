import type { Metadata } from "next";
import { OpportunityScreener } from "./components/OpportunityScreener";
import { filtersFromSearch } from "./lib/screener-query";
import { loadDataset } from "./lib/areas";

export const metadata: Metadata = {
  title: "Discover Markets",
  description:
    "Define an investor buy box and compare explainable neighborhood opportunities with map context and visible data confidence.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: Props) {
  const typedDataset = await loadDataset();
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
