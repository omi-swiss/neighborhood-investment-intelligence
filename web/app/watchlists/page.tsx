import type { Metadata } from "next";
import { PageShell } from "../components/PageShell";
import { WatchlistWorkspace } from "./WatchlistWorkspace";

export const metadata: Metadata = {
  title: "Watchlists & alerts",
  description: "Monitor selected areas, properties, and saved acquisition searches.",
};

export default function WatchlistsPage() {
  return (
    <PageShell
      active="Watchlists"
      eyebrow="Monitoring"
      title="Watchlists & alerts"
      description="Track source-backed changes across neighborhoods, properties, and saved searches."
    >
      <WatchlistWorkspace />
    </PageShell>
  );
}
