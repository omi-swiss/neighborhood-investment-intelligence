import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/initialize";
import { strategyVersions } from "../../../db/schema";
import { builtInStrategies } from "../../lib/areas";
import { SCORE_KEYS } from "../../lib/screener-query";
import type { StrategyDefinition, StrategyWeights } from "../../lib/types";
import { requestUserEmail } from "../../lib/request-user";

function parseWeights(value: unknown): StrategyWeights | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<StrategyWeights>;
  const entries = SCORE_KEYS.map((key) => Number(candidate[key]));
  if (entries.some((weight) => !Number.isFinite(weight) || weight < 0)) return null;
  const total = entries.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return null;
  return Object.fromEntries(
    SCORE_KEYS.map((key, index) => [key, entries[index] / total]),
  ) as StrategyWeights;
}

export async function GET(request: Request) {
  const email = requestUserEmail(request);
  if (!email) {
    return Response.json({ items: builtInStrategies, persistence: "sign-in-required" });
  }
  await ensureSchema();
  const db = await getDb();
  const rows = await db
    .select()
    .from(strategyVersions)
    .where(eq(strategyVersions.userEmail, email))
    .orderBy(asc(strategyVersions.name), asc(strategyVersions.version));
  const userStrategies = rows.flatMap((row): StrategyDefinition[] => {
    const weights = parseWeights(JSON.parse(row.weightsJson));
    return weights
      ? [{
          key: `user:${row.id}`,
          name: row.name,
          version: row.version,
          weights,
          minimumCoverage: row.minimumCoverage / 10_000,
          owner: "user",
        }]
      : [];
  });
  return Response.json({ items: [...builtInStrategies, ...userStrategies], persistence: "d1" });
}

export async function POST(request: Request) {
  const email = requestUserEmail(request);
  if (!email) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as {
    name?: unknown;
    weights?: unknown;
    minimumCoverage?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const weights = parseWeights(body.weights);
  const minimumCoverage = Number(body.minimumCoverage);
  if (
    !name ||
    name.length > 120 ||
    !weights ||
    !Number.isFinite(minimumCoverage) ||
    minimumCoverage < 0 ||
    minimumCoverage > 1
  ) {
    return Response.json(
      { error: "A name, six nonnegative weights, and 0-100% coverage are required." },
      { status: 400 },
    );
  }
  await ensureSchema();
  const db = await getDb();
  const existing = await db
    .select({ version: strategyVersions.version })
    .from(strategyVersions)
    .where(
      and(
        eq(strategyVersions.userEmail, email),
        eq(strategyVersions.name, name),
      ),
    );
  const version =
    Math.max(
      0,
      ...existing
        .filter((row) => row.version > 0)
        .map((row) => row.version),
    ) + 1;
  const [saved] = await db
    .insert(strategyVersions)
    .values({
      userEmail: email,
      name,
      version,
      weightsJson: JSON.stringify(weights),
      minimumCoverage: Math.round(minimumCoverage * 10_000),
    })
    .returning();
  return Response.json(
    {
      item: {
        key: `user:${saved.id}`,
        name: saved.name,
        version: saved.version,
        weights,
        minimumCoverage: saved.minimumCoverage / 10_000,
        owner: "user",
      },
    },
    { status: 201 },
  );
}
