/**
 * scripts/thin-content-purge-live.ts
 *
 * LIVE DELETE. Purges the unattached-thin-lesson candidate set exported by
 * scripts/thin-content-purge-dry-run.ts (archive/thin-content-purge-export-*.json).
 *
 * Per row, ATOMICALLY (single Prisma $transaction array - all-or-nothing):
 *   1. Delete that row's RagChunk rows (sourceType='curriculum_content', sourceId=row.id)
 *   2. Delete the CurriculumContent row itself
 * This ordering means a row can never be left as a newly-orphaned RagChunk
 * set - either both deletes land, or neither does.
 *
 * Re-verifies zero ScheduledWork/Assignment reference for every candidate
 * fresh, immediately at run start - does not trust the export's snapshot.
 * Naturally resumable: each batch skips candidate IDs that no longer exist
 * (already deleted by a prior invocation).
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/thin-content-purge-live.ts [maxBatches]
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const BATCH_SIZE = 25;
const MAX_ERROR_RATE = 0.3;
const MAX_BATCHES_THIS_RUN = Number(process.argv[2] ?? 10);
const EXPORT_PATH = resolve(process.cwd(), "archive", "thin-content-purge-export-2026-07-25.json");

async function main() {
  const { prisma } = await import("@/lib/db");

  if (!existsSync(EXPORT_PATH)) {
    throw new Error(`Export file not found: ${EXPORT_PATH}`);
  }
  const exportData = JSON.parse(readFileSync(EXPORT_PATH, "utf-8"));
  const candidates: Array<{ id: string; contentId: string }> = exportData.rows.map((r: any) => ({
    id: r.id,
    contentId: r.contentId,
  }));
  console.log(`Loaded ${candidates.length} purge candidates from export.`);

  // Fresh re-verification - NOT reused from the export's snapshot.
  const allContentIds = candidates.map((c) => c.contentId);
  const [scheduledWorkRows, assignmentRows] = await Promise.all([
    prisma.scheduledWork.findMany({ where: { contentId: { in: allContentIds } }, select: { contentId: true } }),
    prisma.assignment.findMany({ where: { contentId: { in: allContentIds } }, select: { contentId: true } }),
  ]);
  const nowAttached = new Set<string>();
  for (const r of scheduledWorkRows) nowAttached.add(r.contentId);
  for (const r of assignmentRows) if (r.contentId) nowAttached.add(r.contentId);

  console.log(`\nFresh re-verification at run start:`);
  console.log(`  Candidates now showing a ScheduledWork/Assignment reference (excluded from delete): ${nowAttached.size}`);
  if (nowAttached.size > 0) {
    console.log(`  [EXCLUDED - newly attached since export]:`, [...nowAttached].slice(0, 20));
  }

  const safeCandidates = candidates.filter((c) => !nowAttached.has(c.contentId));
  console.log(`  Confirmed-safe-to-delete: ${safeCandidates.length} / ${candidates.length}`);

  let batchNum = 0;
  let totalDeleted = 0;
  let totalErrors = 0;
  let totalSkippedAlreadyGone = 0;
  let stoppedReason = "exhausted candidate list";

  while (batchNum < MAX_BATCHES_THIS_RUN) {
    batchNum += 1;

    // Resumable: check which candidates still exist (not yet deleted by a prior invocation)
    const idsToCheck = safeCandidates.map((c) => c.id);
    const stillExisting = await prisma.curriculumContent.findMany({
      where: { id: { in: idsToCheck } },
      select: { id: true, contentId: true },
    });
    const existingSet = new Map(stillExisting.map((r) => [r.id, r.contentId]));
    const remaining = safeCandidates.filter((c) => existingSet.has(c.id));

    if (remaining.length === 0) {
      stoppedReason = "all candidates already deleted";
      console.log(`\nAll candidates already deleted. Stopping.`);
      break;
    }

    const batch = remaining.slice(0, BATCH_SIZE);
    console.log(`\n--- Batch ${batchNum}/${MAX_BATCHES_THIS_RUN}: deleting ${batch.length} rows (remaining: ${remaining.length}) ---`);

    let batchDeleted = 0;
    let batchErrors = 0;

    for (const row of batch) {
      try {
        await prisma.$transaction([
          prisma.ragChunk.deleteMany({ where: { sourceType: "curriculum_content", sourceId: row.id } }),
          prisma.curriculumContent.delete({ where: { id: row.id } }),
        ]);

        // Verify THIS row's real DB state immediately
        const [stillThere, orphanChunks] = await Promise.all([
          prisma.curriculumContent.findUnique({ where: { id: row.id }, select: { id: true } }),
          prisma.ragChunk.count({ where: { sourceType: "curriculum_content", sourceId: row.id } }),
        ]);

        if (stillThere || orphanChunks > 0) {
          batchErrors += 1;
          console.log(`  [VERIFY-FAIL] ${row.contentId} (${row.id}): stillThere=${Boolean(stillThere)} orphanChunks=${orphanChunks}`);
        } else {
          batchDeleted += 1;
        }
      } catch (err: any) {
        batchErrors += 1;
        console.log(`  [ERROR] ${row.contentId} (${row.id}): ${err?.message ?? err}`);
      }
    }

    console.log(`  Batch ${batchNum} result: deleted=${batchDeleted} errors=${batchErrors}`);

    totalDeleted += batchDeleted;
    totalErrors += batchErrors;

    const errorRate = batchErrors / batch.length;
    if (errorRate > MAX_ERROR_RATE) {
      stoppedReason = `batch ${batchNum} error rate ${(errorRate * 100).toFixed(1)}% exceeded ${MAX_ERROR_RATE * 100}% threshold`;
      console.log(`\n[ABORT] ${stoppedReason}. Stopping for human review.`);
      break;
    }

    console.log(`  Cumulative this run: deleted=${totalDeleted} errors=${totalErrors}`);

    if (batchNum >= MAX_BATCHES_THIS_RUN) {
      stoppedReason = `reached this invocation's cap of ${MAX_BATCHES_THIS_RUN} batches (re-run to continue)`;
    }
  }

  console.log(`\n=== PURGE RUN SUMMARY (stopped: ${stoppedReason}) ===`);
  console.log(`  Total deleted this run: ${totalDeleted}`);
  console.log(`  Total errors: ${totalErrors}`);
  console.log(`  Newly-attached exclusions this run: ${nowAttached.size}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
