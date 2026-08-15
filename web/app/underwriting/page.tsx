import type { Metadata } from "next";
import { FinancialWorkbench } from "../components/FinancialWorkbench";
import { PageShell } from "../components/PageShell";

export const metadata: Metadata = {
  title: "Financial Underwriting",
  description: "Auditable acquisition, financing, operating, scenario, and multi-year return analysis.",
};

type Props = { searchParams: Promise<{ propertyId?: string; modelId?: string }> };

export default async function UnderwritingPage({ searchParams }: Props) {
  const { propertyId, modelId } = await searchParams;
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
      <FinancialWorkbench propertyId={propertyId} modelId={modelId} />
    </PageShell>
  );
}
