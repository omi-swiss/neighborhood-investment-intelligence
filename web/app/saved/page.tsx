import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { SavedWorkspace } from "./SavedWorkspace";

export const metadata: Metadata = { title: "Saved workspace" };

export default function SavedPage() {
  return (
    <PageShell
      active="Saved Opportunities"
      eyebrow="Private workspace"
      title="Saved Opportunities"
      description="Return to markets, properties, scenarios, and exact strategy versions you saved."
    >
      <SavedWorkspace />
    </PageShell>
  );
}
