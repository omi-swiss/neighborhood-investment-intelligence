import type { Metadata } from "next";
import Link from "next/link";
import { FinancialWorkbench } from "../components/FinancialWorkbench";
import { PageShell } from "../components/PageShell";
import { contextFromSearch } from "../lib/investor-context";

export const metadata: Metadata = {
  title: "Financial Underwriting",
  description: "Auditable acquisition, financing, operating, scenario, and multi-year return analysis.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function UnderwritingPage({ searchParams }: Props) {
  const query = await searchParams;
  const context = contextFromSearch(new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []),
  ));
  const propertyId = typeof query.propertyId === "string" ? query.propertyId : undefined;
  const modelId = typeof query.modelId === "string" ? query.modelId : undefined;
  return (
    <PageShell
      active="Underwriting"
      eyebrow="Investment analysis"
      title="Financial Underwriting"
      description="Build reproducible pre-tax scenarios with visible assumptions, formulas, sources, and version history."
      dataVintages={[
        {
          label: "Underwriting outputs",
          value: "Scenario-based",
          note: "Calculated from the property record and user-entered assumptions; not a dated market observation.",
        },
      ]}
    >
      {context.returnTo ? <Link className="back-link" href={context.returnTo}>← Return to property</Link> : null}
      <FinancialWorkbench propertyId={propertyId} modelId={modelId} />
    </PageShell>
  );
}
