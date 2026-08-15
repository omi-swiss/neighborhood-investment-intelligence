import {
  evidenceContractVersion,
  evidenceLayers,
  productServices,
  type EvidenceStatus,
} from "../../lib/evidence";
import { phase8 } from "../../lib/phase8";

const statuses = new Set<EvidenceStatus>(["integrated", "warehouse_ready", "pipeline_ready"]);

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const phaseParameter = search.get("phase");
  const phase = phaseParameter ? Number(phaseParameter) : null;
  const status = search.get("status") as EvidenceStatus | null;
  const layer = search.get("layer");
  const items = evidenceLayers.filter(
    (item) =>
      (phase === null || !Number.isFinite(phase) || item.phase === phase) &&
      (!status || (statuses.has(status) && item.status === status)) &&
      (!layer || item.id === layer),
  );

  return Response.json(
    {
      contractVersion: evidenceContractVersion,
      generatedAt: phase8.generatedAt,
      items,
      total: items.length,
      productServices,
      interpretation: {
        observed: "Directly published or administratively observed evidence.",
        estimated: "Modeled value with method and uncertainty retained.",
        projected: "Forward scenario or forecast; never labeled as observed.",
        unavailable: "No supported value is returned.",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "X-Evidence-Contract": evidenceContractVersion,
      },
    },
  );
}
