import "dotenv/config";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { routedCompletion } from "@/lib/ai/routedCompletion";
import { logAIInteraction } from "@/lib/ai/interactionLog";

/**
 * P2-C blocker closure, blocker 7: minimal live proof that the
 * interactionLog.ts idempotency fix actually works against real staging
 * telemetry (not mocks). Staging only; refuses to run against production.
 * Hard-capped well under the $1 authorization -- two short, cheap
 * "curriculum" feature calls total.
 *
 * This proof is about telemetry integrity only. The semantic guardrail
 * (rejected AI output never persisting as accepted curriculum evidence) was
 * already independently confirmed by the P2-C confirmation audit (Gate 9)
 * and is not re-exercised here -- this script does not call any curriculum
 * acceptance write path at all, and confirms that by comparing acceptance
 * table row counts before/after.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";
const MAX_TOTAL_SPEND_USD = 1;

function assertStaging(): void {
  const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
  if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");
  if (!url.includes(STAGING_REF)) throw new Error("DATABASE_URL is not the approved staging project");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSING: URL touches the production project ref");
  process.env.DATABASE_URL = url;
}
assertStaging();

const prisma = new PrismaClient();
const ROUTE = "p2c.dedupClosureProof";
const REQUEST_TYPE = "p2c_dedup_closure_proof";

async function countTelemetry() {
  const [interactionCount, legacyLogCount] = await Promise.all([
    prisma.aIInteraction.count({ where: { route: ROUTE, requestType: REQUEST_TYPE } }),
    prisma.aiInteractionLog.count({ where: { endpoint: ROUTE, requestType: REQUEST_TYPE } }),
  ]);
  return { interactionCount, legacyLogCount };
}

async function countAcceptanceTables() {
  const [alignments, coverage, learningTargets, competencies] = await Promise.all([
    prisma.curriculumBaselineAlignment.count(),
    prisma.curriculumCompetencyCoverage.count(),
    prisma.curriculumLearningTarget.count(),
    prisma.assessmentBaselineCompetency.count(),
  ]);
  return { alignments, coverage, learningTargets, competencies };
}

async function main() {
  let cumulativeSpendUSD = 0;
  const PRE_telemetry = await countTelemetry();
  const PRE_acceptance = await countAcceptanceTables();

  console.log("PRE counts:", { PRE_telemetry, PRE_acceptance });

  // --- Call 1: a genuinely new provider invocation ---
  const correlationId1 = randomUUID();
  const completion1 = await routedCompletion({
    messages: [{ role: "user", content: "Reply with exactly one word: ok" }],
    maxTokens: 5,
    aiUsage: {
      route: ROUTE,
      feature: "curriculum",
      requestType: REQUEST_TYPE,
      generationCorrelationId: correlationId1,
      metadata: { proofPurpose: "dedup-closure-call-1" },
    },
  });
  cumulativeSpendUSD += completion1.estimatedCostUSD;
  if (cumulativeSpendUSD > MAX_TOTAL_SPEND_USD) {
    throw new Error(`SPEND_CAP_EXCEEDED after call 1: $${cumulativeSpendUSD.toFixed(6)}`);
  }
  console.log(`Call 1 (correlation ${correlationId1}): model=${completion1.model} cost=$${completion1.estimatedCostUSD.toFixed(6)}`);

  // --- Duplicate persistence attempt for the SAME invocation (this is
  // exactly what the pre-fix P2-C proof script did: routedCompletion's own
  // internal durable write, plus a caller's own explicit durable write,
  // both keyed on the same generationCorrelationId) ---
  await logAIInteraction({
    route: ROUTE,
    feature: "curriculum",
    requestType: REQUEST_TYPE,
    model: completion1.model,
    tier: "fast",
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUSD: 0,
    generationCorrelationId: completion1.generationCorrelationId ?? correlationId1,
    metadata: { proofPurpose: "dedup-closure-call-1-duplicate-attempt" },
    durable: true,
  });
  console.log("Duplicate persistence attempt issued for call 1's correlation id.");

  // --- Call 2: a genuinely new, distinct provider invocation ---
  const correlationId2 = randomUUID();
  const completion2 = await routedCompletion({
    messages: [{ role: "user", content: "Reply with exactly one word: done" }],
    maxTokens: 5,
    aiUsage: {
      route: ROUTE,
      feature: "curriculum",
      requestType: REQUEST_TYPE,
      generationCorrelationId: correlationId2,
      metadata: { proofPurpose: "dedup-closure-call-2" },
    },
  });
  cumulativeSpendUSD += completion2.estimatedCostUSD;
  if (cumulativeSpendUSD > MAX_TOTAL_SPEND_USD) {
    throw new Error(`SPEND_CAP_EXCEEDED after call 2: $${cumulativeSpendUSD.toFixed(6)}`);
  }
  console.log(`Call 2 (correlation ${correlationId2}): model=${completion2.model} cost=$${completion2.estimatedCostUSD.toFixed(6)}`);

  // Give any non-durable fire-and-forget writes a moment to settle before
  // counting. provenanceWritersEnabled() was observed false in this script's
  // environment (routedCompletion's internal write is fire-and-forget, not
  // awaited), and a first attempt at this proof found 500ms was not always
  // enough for that write to land before the process exits -- 3s is a wide
  // margin given the earlier observed real-world completion time (~1.5s).
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const POST_telemetry = await countTelemetry();
  const POST_acceptance = await countAcceptanceTables();

  const distinctRows1 = await prisma.aIInteraction.findMany({
    where: { generationCorrelationId: completion1.generationCorrelationId ?? correlationId1 },
    select: { id: true },
  });
  const distinctRows2 = await prisma.aIInteraction.findMany({
    where: { generationCorrelationId: completion2.generationCorrelationId ?? correlationId2 },
    select: { id: true },
  });

  const report = {
    startedAt: new Date().toISOString(),
    stagingProjectRef: STAGING_REF,
    spendCapUSD: MAX_TOTAL_SPEND_USD,
    cumulativeSpendUSD,
    PRE_telemetry,
    POST_telemetry,
    telemetryDelta: {
      AIInteraction: POST_telemetry.interactionCount - PRE_telemetry.interactionCount,
      AiInteractionLog: POST_telemetry.legacyLogCount - PRE_telemetry.legacyLogCount,
    },
    PRE_acceptance,
    POST_acceptance,
    acceptanceTablesDelta: {
      alignments: POST_acceptance.alignments - PRE_acceptance.alignments,
      coverage: POST_acceptance.coverage - PRE_acceptance.coverage,
      learningTargets: POST_acceptance.learningTargets - PRE_acceptance.learningTargets,
      competencies: POST_acceptance.competencies - PRE_acceptance.competencies,
    },
    call1: {
      correlationId: completion1.generationCorrelationId ?? correlationId1,
      canonicalRowCount: distinctRows1.length,
      expectedCanonicalRowCount: 1,
      dedupWorked: distinctRows1.length === 1,
    },
    call2: {
      correlationId: completion2.generationCorrelationId ?? correlationId2,
      canonicalRowCount: distinctRows2.length,
      expectedCanonicalRowCount: 1,
      remainedDistinctFromCall1: (completion2.generationCorrelationId ?? correlationId2) !== (completion1.generationCorrelationId ?? correlationId1),
    },
  };

  console.log("\n=== LIVE POST-FIX TELEMETRY PROOF ===");
  console.log(JSON.stringify(report, null, 2));

  const outPath = join(process.cwd(), "docs", "ops", "P2C_LIVE_DEDUP_PROOF.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${outPath}`);

  const ok =
    report.call1.dedupWorked &&
    report.call2.canonicalRowCount === 1 &&
    report.call2.remainedDistinctFromCall1 &&
    report.telemetryDelta.AIInteraction === 2 && // call1 (1 canonical row, duplicate suppressed) + call2 (1 canonical row)
    report.telemetryDelta.AiInteractionLog === 2 &&
    report.acceptanceTablesDelta.alignments === 0 &&
    report.acceptanceTablesDelta.coverage === 0 &&
    report.acceptanceTablesDelta.learningTargets === 0 &&
    report.acceptanceTablesDelta.competencies === 0;

  console.log(ok ? "\nRESULT: PASS -- dedup fix verified live against staging." : "\nRESULT: FAIL -- see deltas above.");
  if (!ok) process.exitCode = 1;

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
