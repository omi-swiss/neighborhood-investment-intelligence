import type { Metadata } from "next";
import { PageShell } from "../../components/PageShell";
import { PropertyProfile } from "./PropertyProfile";
import { contextFromSearch } from "../../lib/investor-context";

export const metadata: Metadata = { title: "Property profile" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function PropertyPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const context = contextFromSearch(new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []),
  ));
  return (
    <PageShell
      active="Properties"
      eyebrow="Property review"
      title="Property profile"
      description="Imported facts, transparent screening signals, neighborhood context, and source lineage."
    >
      <PropertyProfile propertyId={id} returnTo={context.returnTo} />
    </PageShell>
  );
}
