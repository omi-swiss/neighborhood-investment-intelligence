import type { Metadata } from "next";
import { PageShell } from "../../components/PageShell";
import { StrategyEditor } from "./StrategyEditor";

export const metadata: Metadata = { title: "Strategy settings" };

export default function StrategiesPage() {
  return (
    <PageShell
      active="Strategies"
      eyebrow="Versioned scoring"
      title="Strategy settings"
      description="Tune transparent component weights without changing the underlying evidence."
    >
      <StrategyEditor />
    </PageShell>
  );
}
