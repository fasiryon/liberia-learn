/**
 * scripts/moe-alignment-live-backfill.ts
 *
 * LIVE WRITE. Approved scope only:
 *   - rows with a genuine keyword match (score >= 0.15)
 *   - rows needing the AI fallback (real candidate standards exist, keyword found nothing)
 * Excludes entirely: rows whose subject/band has zero standards defined
 * (the 1,114-row structural gap - Sprint 7.1's standards-authoring backlog,
 * not touched by this script under any condition).
 *
 * Connection note: DIRECT_URL (db.<project>.supabase.co:5432) is confirmed
 * unreachable from this environment (tested twice, consistent failure) - the
 * pooled DATABASE_URL (Supavisor, connection_limit=1) is the only reachable
 * path here. Compensating with a much smaller batch size (25, not 200), a
 * single shared PrismaClient (lib/db.ts's singleton, same one
 * alignContentToMOE uses - a second client here would starve this one for
 * the single allowed pooled connection), and a hard per-invocation batch cap
 * so each run is a small, reviewable unit.
 *
 * Calls the real, fixed lib/moe/alignment-engine.ts::alignContentToMOE for
 * each row (same code path production would use). Naturally resumable:
 * each batch re-queries remaining NULL rows, so a kill/restart just picks up
 * where it left off. After EVERY row - not just at batch end - re-queries
 * that exact row's real DB state to confirm the write landed as expected
 * before moving on, so a partial/silent failure is caught immediately, not
 * discovered later. Aborts if error rate looks anomalous (>30% in a batch).
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/moe-alignment-live-backfill.ts [maxBatches]
 *   (maxBatches defaults to 4 - i.e. 100 rows per invocation - so a single
 *   run stays a bounded, reviewable unit; re-run to continue.)
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { Prisma } from "@prisma/client";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const STATUS_FILTER = ["APPROVED", "published", "approved"];
const BATCH_SIZE = 25;
const INTER_ROW_DELAY_MS = 200;
const MAX_ERROR_RATE = 0.3;
const MAX_BATCHES_THIS_RUN = Number(process.argv[2] ?? 4);

const SUBJECT_MAP: Record<string, string> = {
  math: "MATH", mathematics: "MATH", science: "SCIENCE", literacy: "LITERACY",
  english: "LITERACY", reading: "LITERACY", civics: "CIVICS", "social studies": "CIVICS",
  social_studies: "CIVICS", "computer science": "COMPUTER_SCIENCE",
  computer_science: "COMPUTER_SCIENCE", computing: "COMPUTER_SCIENCE", ict: "COMPUTER_SCIENCE",
  engineering: "ENGINEERING", arts: "ARTS", pe: "PE", career: "CAREER",
};
function gradeToBand(grade: number) {
  if (grade <= 3) return "G1_3";
  if (grade <= 6) return "G4_6";
  if (grade <= 9) return "G7_9";
  return "G10_12";
}

async function main() {
  const { prisma } = await import("@/lib/db");
  const { alignContentToMOE } = await import("../lib/moe/alignment-engine");

  const allStandards = await prisma.standard.findMany({ select: { subject: true, band: true } });
  const standardsKeys = new Set(allStandards.map((s) => `${s.subject}::${s.band}`));

  function hasRealStandards(subject: string, grade: number): boolean {
    const mapped = SUBJECT_MAP[subject.toLowerCase()];
    if (!mapped) return false;
    return standardsKeys.has(`${mapped}::${gradeToBand(grade)}`);
  }

  let batchNum = 0;
  let totalProcessed = 0;
  let totalGenuineMatch = 0;
  let totalEmptyAttempt = 0;
  let totalErrors = 0;
  let stoppedReason = "exhausted eligible rows";

  while (batchNum < MAX_BATCHES_THIS_RUN) {
    batchNum += 1;

    const overfetch = await prisma.curriculumContent.findMany({
      where: { status: { in: STATUS_FILTER }, moeAlignments: { equals: Prisma.DbNull } },
      select: { id: true, contentId: true, grade: true, subject: true },
      orderBy: { id: "asc" },
      take: 2000,
    });

    const eligible = overfetch.filter((c) => hasRealStandards(c.subject, c.grade));
    if (eligible.length === 0) {
      console.log(`\nNo more eligible rows remain (structural-gap rows, if any, are intentionally left untouched). Stopping.`);
      break;
    }

    const batch = eligible.slice(0, BATCH_SIZE);
    console.log(`\n--- Batch ${batchNum}/${MAX_BATCHES_THIS_RUN}: processing ${batch.length} rows (eligible remaining this scan: ${eligible.length}) ---`);

    let batchErrors = 0;
    let batchGenuine = 0;
    let batchEmpty = 0;

    for (const row of batch) {
      try {
        const result = await alignContentToMOE(row.id);

        // Verify THIS row's real DB state immediately, not just at batch end.
        const verified = await prisma.curriculumContent.findUnique({
          where: { id: row.id },
          select: { moeAlignments: true },
        });
        const shapeOk =
          verified?.moeAlignments &&
          typeof verified.moeAlignments === "object" &&
          !Array.isArray(verified.moeAlignments) &&
          Array.isArray((verified.moeAlignments as any).standards);

        if (!shapeOk) {
          batchErrors += 1;
          console.log(`  [VERIFY-FAIL] ${row.contentId} (${row.id}): write did not land with expected shape`);
        } else if (result.standards.length > 0) {
          batchGenuine += 1;
        } else {
          batchEmpty += 1;
        }
      } catch (err: any) {
        batchErrors += 1;
        console.log(`  [ERROR] ${row.contentId} (${row.id}): ${err?.message ?? err}`);
      }
      await new Promise((res) => setTimeout(res, INTER_ROW_DELAY_MS));
    }

    console.log(`  Batch ${batchNum} result: genuine=${batchGenuine} empty=${batchEmpty} errors=${batchErrors}`);

    totalProcessed += batch.length;
    totalGenuineMatch += batchGenuine;
    totalEmptyAttempt += batchEmpty;
    totalErrors += batchErrors;

    const errorRate = batchErrors / batch.length;
    if (errorRate > MAX_ERROR_RATE) {
      stoppedReason = `batch ${batchNum} error rate ${(errorRate * 100).toFixed(1)}% exceeded ${MAX_ERROR_RATE * 100}% threshold`;
      console.log(`\n[ABORT] ${stoppedReason}. Stopping for human review.`);
      break;
    }

    console.log(`  Cumulative this run: processed=${totalProcessed} genuine=${totalGenuineMatch} empty=${totalEmptyAttempt} errors=${totalErrors}`);

    if (batchNum >= MAX_BATCHES_THIS_RUN) {
      stoppedReason = `reached this invocation's cap of ${MAX_BATCHES_THIS_RUN} batches (re-run to continue)`;
    }
  }

  console.log(`\n=== BACKFILL RUN SUMMARY (stopped: ${stoppedReason}) ===`);
  console.log(`  Total processed this run: ${totalProcessed}`);
  console.log(`  Genuine matches: ${totalGenuineMatch}`);
  console.log(`  Attempted, no match found: ${totalEmptyAttempt}`);
  console.log(`  Errors: ${totalErrors}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
