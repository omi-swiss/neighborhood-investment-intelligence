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
const maxDevelopmentSignalsPerMarket = 75;

// Keep the Signals route compact while ensuring that a later-added market is
// never excluded simply because an earlier market filled a global limit.
function developmentSignalsByMarket() {
  const counts = new Map<string, number>();
  return phase8.developmentPins.filter((pin) => {
    const marketId = pin.marketId ?? washingtonMarketId;
    const count = counts.get(marketId) ?? 0;
    if (count >= maxDevelopmentSignalsPerMarket) return false;
    counts.set(marketId, count + 1);
    return true;
  });
}

function developmentStage(pin: typeof phase8.developmentPins[number]) {
  if (pin.id.startsWith("nyc_dob_now_filings:")) return "DOB filing activity";
  if (pin.id.startsWith("nyc_dob_permits:")) return "Permit issued";
  return "Permit issued";
}

function developmentCategory(pin: typeof phase8.developmentPins[number]) {
  if (pin.id.startsWith("nyc_dob_now_filings:")) return "Official DOB filing";
  if (pin.id.startsWith("nyc_dob_permits:")) return "Issued DOB permit";
  return "Development permit";
}

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
  ...developmentSignalsByMarket().map((pin) => ({
    id: `permit:${pin.id}`,
    marketId: pin.marketId ?? washingtonMarketId,
    category: developmentCategory(pin),
    title: pin.address,
    organization: pin.ownerOrApplicant ?? "Applicant unavailable",
    stage: developmentStage(pin),
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
