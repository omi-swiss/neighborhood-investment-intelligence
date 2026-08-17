import type { Metadata } from "next";
import { SignalsWorkspace, type SignalEvent } from "../components/SignalsWorkspace";
import { PageShell } from "../components/PageShell";
import { phase8 } from "../lib/phase8";
import { remainingGaps } from "../lib/remaining-gaps";
import { curatedMarketEvents, marketContexts, marketMigrationContexts } from "../data/market-context";
import { federalCommunityDevelopmentEvents } from "../data/signal-sources";
import { coreMetadata } from "../data/core-metadata";
import { marketProfiles } from "../data/market-profiles";

export const metadata: Metadata = { title: "Signals & services" };

const washingtonMarketId = "place:1150000";

function classifyEvent(event: SignalEvent): SignalEvent {
  const text = `${event.category} ${event.title}`.toLowerCase();
  const signalType: SignalEvent["signalType"] = event.signalType ??
    (event.id.startsWith("permit:") ? "Permit" :
      /planning|zoning|comprehensive plan/.test(text) ? "Planning / zoning" :
      /infrastructure|transit|capital project|public-realm/.test(text) ? "Infrastructure / transit" :
      /employer|office|manufactur|job/.test(text) ? "Employer investment" :
      /private investment/.test(text) ? "Private development" :
      /grant|public investment|neighborhood reinvestment/.test(text) ? "State / local grant" :
      "Private development");
  const fundingLevel: SignalEvent["fundingLevel"] = event.fundingLevel ??
    (signalType === "Private development" || signalType === "Employer investment" ? "Private" :
      signalType === "Federal award" ? "Federal" :
      signalType === "Planning / zoning" || signalType === "Permit" ? "Not applicable" :
      /state|maryland|massachusetts|illinois|pennsylvania/.test(`${event.organization} ${event.sourceUrl}`.toLowerCase()) ? "State" :
      "Local");
  return {
    ...event,
    signalType,
    fundingLevel,
    geographyScope: event.geographyScope ?? "City",
    amountType: event.amountType ?? (event.investmentAmount ? "Investment" : undefined),
    sourceClass: event.sourceClass ??
      (event.id.startsWith("permit:") ? "Official permit" :
        signalType === "Planning / zoning" ? "Official planning" :
        event.evidenceStatus === "candidate" ? undefined :
        fundingLevel === "Private" ? "Company primary" :
        "Official program"),
    lastVerifiedDate: event.lastVerifiedDate ?? (event.evidenceStatus === "verified-source" ? "2026-07-30" : undefined),
  };
}

const events: SignalEvent[] = [
  ...curatedMarketEvents,
  ...federalCommunityDevelopmentEvents,
  ...phase8.developmentPins.slice(0, 75).map((pin) => ({
    id: `permit:${pin.id}`,
    marketId: washingtonMarketId,
    category: "Development permit",
    title: pin.address,
    organization: pin.ownerOrApplicant ?? "Applicant unavailable",
    stage: "Permit issued",
    date: pin.issueDate,
    sourceUrl: pin.sourceUrl,
    evidenceStatus: "verified-source" as const,
  })),
  ...remainingGaps.publicInvestmentCandidates.slice(0, 75).map((item) => ({
    id: `award:${item.id}`,
    marketId: washingtonMarketId,
    category: "Public investment lead",
    title: item.description ?? item.projectType,
    organization: item.recipient ?? "Recipient unavailable",
    stage: "Analyst review",
    date: null,
    sourceUrl: item.sourceUrl,
    evidenceStatus: "candidate" as const,
  })),
].map(classifyEvent);

export default function SignalsPage() {
  return (
    <PageShell
      active="Signals"
      eyebrow="Market intelligence"
      title="Signals & services"
      description="City profiles, investment events, development evidence, and regulatory context."
      actions={<a className="button" href="/sources">View source registry</a>}
      dataVintages={[
        {
          label: "Net migration",
          value: "IRS 2022-2023",
          note: "Latest IRS county-to-county release; published March 19, 2026.",
        },
        {
          label: "Property tax",
          value: "ACS 2024 5-year",
          note: "2020-2024 survey window.",
        },
        {
          label: "Political context",
          value: "2024 certified results",
        },
        {
          label: "Projects and regulation",
          value: "Dated per record",
          note: "Source review date is shown with each item.",
        },
      ]}
    >
      <SignalsWorkspace
        generatedAt={coreMetadata.generatedAt}
        profiles={marketProfiles}
        events={events}
        contexts={marketContexts}
        migrations={marketMigrationContexts}
      />
    </PageShell>
  );
}
