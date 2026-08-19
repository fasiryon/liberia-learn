import "dotenv/config";
import { logAIInteraction } from "@/lib/ai/interactionLog";

/**
 * One "writer" in the distributed dedup proof
 * (scripts/p2c-distributed-dedup-proof.ts). Runs as its own OS process --
 * spawned via child_process.spawn, not imported -- so this genuinely
 * exercises cross-process concurrency against the database, not just
 * concurrent promises inside one event loop. Uses an already-structured,
 * fixture-shaped "provider response" (no real model call, no spend) since
 * what this proves is the database's dedupeKey uniqueness invariant, not
 * AI output quality.
 *
 * Usage: tsx p2c-distributed-dedup-writer.ts <dedupeKey> <writerLabel>
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";
function assertStaging(): void {
  const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
  if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");
  if (!url.includes(STAGING_REF)) throw new Error("not staging");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSING production");
  process.env.DATABASE_URL = url;
}
assertStaging();

const [, , dedupeKey, writerLabel] = process.argv;
if (!dedupeKey || !writerLabel) {
  console.error("usage: tsx p2c-distributed-dedup-writer.ts <dedupeKey> <writerLabel>");
  process.exit(1);
}

async function main() {
  const result = await logAIInteraction({
    route: "p2c.distributedDedupProof",
    feature: "curriculum",
    requestType: "p2c_distributed_dedup_proof",
    generationCorrelationId: dedupeKey,
    model: "fixture-gpt-4o-mini",
    tier: "smart",
    inputTokens: 1500,
    outputTokens: 200,
    estimatedCostUSD: 0, // fixture write, no real provider call, no spend
    promptKey: "curriculum.waecBaselineAlignment.system",
    promptVersion: "1.2.0",
    metadata: { writerLabel, fixture: true },
    durable: true,
  });
  console.log(JSON.stringify({ writerLabel, dedupeKey, result }));
}

main().catch((error) => {
  console.error(JSON.stringify({ writerLabel, dedupeKey, error: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
});
