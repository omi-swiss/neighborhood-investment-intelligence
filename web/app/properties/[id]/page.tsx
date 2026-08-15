import type { Metadata } from "next";
import { PageShell } from "../../components/PageShell";
import { PropertyProfile } from "./PropertyProfile";

export const metadata: Metadata = { title: "Property profile" };

type Props = { params: Promise<{ id: string }> };

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  return (
    <PageShell
      active="Properties"
      eyebrow="Property review"
      title="Property profile"
      description="Imported facts, transparent screening signals, neighborhood context, and source lineage."
    >
      <PropertyProfile propertyId={id} />
    </PageShell>
  );
}
