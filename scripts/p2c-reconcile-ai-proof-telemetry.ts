import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C blocker closure, blocker 2: read-only reconciliation of the durable
 * live-AI-SME-proof artifact against actual staging telemetry.
 *
 * The independent confirmation audit found the committed artifact
 * (docs/ops/P2C_LIVE_AI_SME_PROOF.json) documents only 4 cases, but staging
 * telemetry shows 8 distinct real provider invocations across the
 * debugging session that produced it (the remediation record's own prose
 * already discloses "two runs spent isolating a telemetry bug" before the
 * final run -- this script re-derives the exact numbers instead of trusting
 * that prose or the audit's numbers).
 *
 * Read-only: only SELECT queries against staging. Refuses to run against
 * production. Does not delete or mutate any existing row.
 */

const STAGING_REF = "yonpfzjczoffhrgibxkz";
const PRODUCTION_REF = "bnphuinpvgpmebcsvmsp";

function assertStaging(): void {
  const url = process.env.P2A_STAGING_DATABASE_URL?.trim();
  if (!url) throw new Error("P2A_STAGING_DATABASE_URL is required");
  if (!url.includes(STAGING_REF)) throw new Error("DATABASE_URL is not the approved staging project");
  if (url.includes(PRODUCTION_REF)) throw new Error("REFUSING: URL touches the production project ref");
  process.env.DATABASE_URL = url;
}
assertStaging();

const prisma = new PrismaClient();

const ROUTE = "curriculum.waecBaselineAlignment";
const REQUEST_TYPE = "p2c_live_ai_sme_proof";

type Row = {
  id: string;
  generationCorrelationId: string | null;
  model: string | null;
  estimatedCostUSD: number;
  tokensUsed: number;
  createdAt: Date;
  metadata: unknown;
};

async function main() {
  const rows = (await prisma.aIInteraction.findMany({
    where: { route: ROUTE, requestType: REQUEST_TYPE },
    select: {
      id: true,
      generationCorrelationId: true,
      model: true,
      estimatedCostUSD: true,
      tokensUsed: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: "asc" },
  })) as Row[];

  const legacyLogCount = await prisma.aiInteractionLog.count({
    where: { requestType: REQUEST_TYPE, endpoint: ROUTE },
  });

  const rawAIInteractionRows = rows.length;
  const byCorrelation = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.generationCorrelationId ?? `__no_correlation_${row.id}`;
    const list = byCorrelation.get(key) ?? [];
    list.push(row);
    byCorrelation.set(key, list);
  }
  const distinctInvocations = [...byCorrelation.entries()].map(([correlationId, dupes]) => {
    const canonical = dupes[0]; // earliest by createdAt (query is ordered asc)
    const proofRunId =
      canonical.metadata && typeof canonical.metadata === "object" && "proofRunId" in canonical.metadata
        ? String((canonical.metadata as Record<string, unknown>).proofRunId)
        : null;
    const proofCase =
      canonical.metadata && typeof canonical.metadata === "object" && "proofCase" in canonical.metadata
        ? String((canonical.metadata as Record<string, unknown>).proofCase)
        : null;
    return {
      correlationId,
      proofRunId,
      proofCase,
      model: canonical.model,
      tokensUsed: canonical.tokensUsed,
      estimatedCostUSD: canonical.estimatedCostUSD,
      firstPersistedAt: canonical.createdAt.toISOString(),
      duplicateRowCount: dupes.length - 1,
      allRowIds: dupes.map((d) => d.id),
    };
  });

  const distinctProviderInvocations = distinctInvocations.length;
  const duplicatePersistenceRows = rawAIInteractionRows - distinctProviderInvocations;
  const totalProviderCost = distinctInvocations.reduce((sum, inv) => sum + inv.estimatedCostUSD, 0);

  // Runs, grouped by proofRunId (one run = one execution of
  // scripts/p2c-live-ai-sme-proof.ts, each a real batch of paid provider calls).
  const byRun = new Map<string, typeof distinctInvocations>();
  for (const inv of distinctInvocations) {
    const key = inv.proofRunId ?? "__unknown_run__";
    const list = byRun.get(key) ?? [];
    list.push(inv);
    byRun.set(key, list);
  }
  const runs = [...byRun.entries()]
    .map(([proofRunId, invocations]) => ({
      proofRunId,
      invocationCount: invocations.length,
      cases: invocations.map((i) => i.proofCase),
      firstPersistedAt: invocations.reduce(
        (min, i) => (i.firstPersistedAt < min ? i.firstPersistedAt : min),
        invocations[0].firstPersistedAt
      ),
      costUSD: invocations.reduce((sum, i) => sum + i.estimatedCostUSD, 0),
    }))
    .sort((a, b) => a.firstPersistedAt.localeCompare(b.firstPersistedAt));

  const documentedArtifactPath = join(process.cwd(), "docs", "ops", "P2C_LIVE_AI_SME_PROOF.json");
  const documented = JSON.parse(
    await import("node:fs").then((fs) => fs.readFileSync(documentedArtifactPath, "utf8"))
  ) as { runId: string; cases: Array<{ invocationId: string }> };
  const documentedCorrelationIds = new Set(documented.cases.map((c) => c.invocationId));
  const documentedRun = runs.find((r) => r.proofRunId === documented.runId);
  const earlierBatchRuns = runs.filter((r) => r.proofRunId !== documented.runId);

  const reconciliation = {
    reconciledAt: new Date().toISOString(),
    method:
      "SELECT-only query of AIInteraction (route='curriculum.waecBaselineAlignment', requestType='p2c_live_ai_sme_proof') and count of AiInteractionLog rows with the same endpoint/requestType, on staging (yonpfzjczoffhrgibxkz), no rows deleted or mutated.",
    rawAIInteractionRows,
    rawAiInteractionLogRows: legacyLogCount,
    distinctProviderInvocations,
    duplicatePersistenceRows,
    duplicationMechanism:
      "Prior to the interactionLog.ts idempotency fix in this closure pass, routedCompletion() logged internally via logAIInteraction() (awaited/durable whenever feature==='curriculum' && provenanceWritersEnabled(), true on staging) AND scripts/p2c-live-ai-sme-proof.ts called logAIInteraction() a second time itself (also durable: true) using the same generationCorrelationId, as a defensive measure against routedCompletion's internal write being fire-and-forget in non-curriculum/non-provenance contexts. Both calls unconditionally created a new row with no dedup guard, so every real invocation was persisted twice in AIInteraction and, when the second call also went on to write AiInteractionLog, twice there too. Fixed in this pass: logAIInteraction() now looks up an existing AIInteraction row by generationCorrelationId before creating one, and only writes the legacy AiInteractionLog row when it is actually creating a new canonical AIInteraction row. See lib/ai/interactionLog.ts and __tests__/ai.interactionLog.test.ts (dedup describe block).",
    totalProviderCostUSD: totalProviderCost,
    documentedTestCases: documented.cases.length,
    documentedRunId: documented.runId,
    documentedRunInvocations: documentedRun?.invocationCount ?? 0,
    priorEarlierBatchInvocations: earlierBatchRuns.reduce((sum, r) => sum + r.invocationCount, 0),
    runs,
    distinctInvocations,
  };

  const outPath = join(process.cwd(), "docs", "ops", "P2C_AI_TELEMETRY_RECONCILIATION.json");
  writeFileSync(outPath, JSON.stringify(reconciliation, null, 2) + "\n", "utf8");

  console.log(JSON.stringify(reconciliation, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(
    `\nrawAIInteractionRows=${rawAIInteractionRows} distinctProviderInvocations=${distinctProviderInvocations} duplicatePersistenceRows=${duplicatePersistenceRows} rawAiInteractionLogRows=${legacyLogCount} totalProviderCostUSD=${totalProviderCost}`
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
