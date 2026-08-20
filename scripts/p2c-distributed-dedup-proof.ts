import "dotenv/config";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * P2-C infrastructure closure: live proof that the dedupeKey unique index
 * (prisma/canonical/migrations/20260819_000001_p2c_ai_interaction_dedupekey_unique)
 * enforces the invariant across genuinely separate OS processes, not just
 * within one Node event loop. Staging only, near-zero cost (no real
 * provider calls -- fixture-shaped writes only, per this pass's explicit
 * allowance).
 *
 * Writers A and B are spawned as two independent child processes and race
 * each other with the SAME dedupeKey; the database, not application code,
 * decides which one wins. Writer C uses a different dedupeKey and must
 * remain a fully separate row.
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

const prisma = new PrismaClient();
const ROUTE = "p2c.distributedDedupProof";
const REQUEST_TYPE = "p2c_distributed_dedup_proof";

function spawnWriter(dedupeKey: string, label: string): Promise<{ label: string; stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["tsx", "scripts/p2c-distributed-dedup-writer.ts", dedupeKey, label],
      { cwd: process.cwd(), env: process.env, shell: true }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (exitCode) => resolve({ label, stdout, stderr, exitCode }));
  });
}

async function countTelemetry() {
  const [interactionCount, legacyLogCount] = await Promise.all([
    prisma.aIInteraction.count({ where: { route: ROUTE, requestType: REQUEST_TYPE } }),
    prisma.aiInteractionLog.count({ where: { endpoint: ROUTE, requestType: REQUEST_TYPE } }),
  ]);
  return { interactionCount, legacyLogCount };
}

async function main() {
  const sharedDedupeKey = randomUUID();
  const distinctDedupeKey = randomUUID();

  console.log(`Shared dedupeKey (Writers A & B): ${sharedDedupeKey}`);
  console.log(`Distinct dedupeKey (Writer C): ${distinctDedupeKey}`);

  const PRE = await countTelemetry();
  console.log("PRE counts:", PRE);

  // --- Writers A and B: genuinely separate OS processes, same dedupeKey, launched concurrently ---
  const [resultA, resultB] = await Promise.all([
    spawnWriter(sharedDedupeKey, "WriterA"),
    spawnWriter(sharedDedupeKey, "WriterB"),
  ]);
  console.log("Writer A:", resultA.stdout.trim() || resultA.stderr.trim(), "exit:", resultA.exitCode);
  console.log("Writer B:", resultB.stdout.trim() || resultB.stderr.trim(), "exit:", resultB.exitCode);

  // --- Writer C: distinct dedupeKey, must remain a separate row ---
  const resultC = await spawnWriter(distinctDedupeKey, "WriterC");
  console.log("Writer C:", resultC.stdout.trim() || resultC.stderr.trim(), "exit:", resultC.exitCode);

  const POST = await countTelemetry();
  console.log("POST counts:", POST);

  const sharedRows = await prisma.aIInteraction.findMany({
    where: { generationCorrelationId: sharedDedupeKey },
    select: { id: true, metadata: true, createdAt: true },
  });
  const distinctRows = await prisma.aIInteraction.findMany({
    where: { generationCorrelationId: distinctDedupeKey },
    select: { id: true, metadata: true, createdAt: true },
  });
  const sharedLogRows = await prisma.aiInteractionLog.count({
    where: { endpoint: ROUTE, requestType: REQUEST_TYPE, timestamp: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
  });

  const report = {
    startedAt: new Date().toISOString(),
    stagingProjectRef: STAGING_REF,
    sharedDedupeKey,
    distinctDedupeKey,
    PRE,
    POST,
    telemetryDelta: {
      AIInteraction: POST.interactionCount - PRE.interactionCount,
      AiInteractionLog: POST.legacyLogCount - PRE.legacyLogCount,
    },
    writerA: { exitCode: resultA.exitCode, output: resultA.stdout.trim() || resultA.stderr.trim() },
    writerB: { exitCode: resultB.exitCode, output: resultB.stdout.trim() || resultB.stderr.trim() },
    writerC: { exitCode: resultC.exitCode, output: resultC.stdout.trim() || resultC.stderr.trim() },
    sharedDedupeKeyRowCount: sharedRows.length,
    sharedDedupeKeyRows: sharedRows,
    distinctDedupeKeyRowCount: distinctRows.length,
    distinctDedupeKeyRows: distinctRows,
    conflictBehavior:
      resultA.exitCode === 0 && resultB.exitCode === 0
        ? "both writers completed successfully -- one performed the real INSERT, the other received a database-reported unique-constraint conflict and resolved to the same row (see application logs for which)"
        : "at least one writer process failed unexpectedly -- see writerA/writerB output",
  };

  console.log("\n=== DISTRIBUTED DEDUP PROOF ===");
  console.log(JSON.stringify(report, null, 2));

  const outPath = join(process.cwd(), "docs", "ops", "P2C_DISTRIBUTED_DEDUP_PROOF.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`\nWrote ${outPath}`);

  const ok =
    sharedRows.length === 1 && // A and B, same dedupeKey -> exactly one canonical row
    distinctRows.length === 1 && // C, different dedupeKey -> its own row
    report.telemetryDelta.AIInteraction === 2 && // 1 (shared) + 1 (distinct), not 3
    report.telemetryDelta.AiInteractionLog === 2 &&
    resultA.exitCode === 0 &&
    resultB.exitCode === 0 &&
    resultC.exitCode === 0;

  console.log(ok ? "\nRESULT: PASS -- database-enforced idempotency verified across separate OS processes." : "\nRESULT: FAIL -- see report above.");
  if (!ok) process.exitCode = 1;

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
