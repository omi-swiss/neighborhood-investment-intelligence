import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "../components/PageShell";
import { PropertyMarketplace, type Filters } from "../components/PropertyMarketplace";
import { PublicPropertyDirectory } from "../components/PublicPropertyDirectory";
import { propertyMarketDirectory } from "../data/property-markets";

export const metadata: Metadata = {
  title: "Analyze Property",
  description: "Research listings, recorded sales, and off-market prospects across supported markets.",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function text(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function nonnegative(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default async function PropertiesPage({ searchParams }: Props) {
  const query = await searchParams;
  const requestedMarket = text(query.market);
  const initialMarket = propertyMarketDirectory.some((item) => item.city === requestedMarket)
    ? requestedMarket
    : "";
  const initialMarketId = propertyMarketDirectory.find((item) => item.city === initialMarket)?.id ?? "all";
  const initialFilters: Filters = {
    search: text(query.search),
    city: initialMarket,
    propertyType: text(query.propertyType),
    maximumPrice: nonnegative(query.maximumPrice, 10_000_000),
    minimumGrossYield: nonnegative(query.minimumGrossYield, 0),
    minimumCompleteness: nonnegative(query.minimumCompleteness, 0),
  };

  return (
    <PageShell
      active="Analyze Property"
      eyebrow="Investor workflow · Step 2"
      title="Analyze Property"
      description="Find, enter, or import a property, then move into auditable underwriting without confusing public records, prospects, and active listings."
      actions={<Link className="button" href="/api/properties/template">Import template</Link>}
      dataVintages={[
        {
          label: "Public property records",
          value: "Record date shown per property",
          note: "Availability varies by market.",
        },
        {
          label: "Listings",
          value: "Authorized imports only",
          note: "No listing availability or asking price is fabricated from assessor data.",
        },
      ]}
    >
      <PublicPropertyDirectory markets={propertyMarketDirectory} initialMarketId={initialMarketId} />

      <section className="authorized-marketplace-head">
        <div>
          <p className="eyebrow">Authorized deal workspace</p>
          <h2>Listings, broker files, and owner-submitted opportunities</h2>
          <p>
            Import licensed or permissioned property records, then compare yield, completeness,
            location, and underwriting evidence in one private workspace.
          </p>
        </div>
      </section>

      <PropertyMarketplace
        initialFilters={initialFilters}
        markets={propertyMarketDirectory}
      />
    </PageShell>
  );
}
