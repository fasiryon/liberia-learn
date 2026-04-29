/**
 * Safe batch runner for Grade 5 ENGLISH audio generation.
 * Processes PENDING rows in batches of 5.
 * Stop rules:
 *   - > 1 failure in any batch
 *   - Supabase upload failure
 *   - OpenAI rate-limit error (repeated)
 *   - No more PENDING rows
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { processLessonAudioBatch } from "@/scripts/process-lesson-audio";
import { prisma } from "@/lib/db";

const BATCH_SIZE = 5;
const MAX_FAILURES_PER_BATCH = 1;

const RATE_LIMIT_PHRASES = ["rate limit", "rate_limit", "429", "too many requests", "quota"];
const SUPABASE_FAIL_PHRASES = ["supabase upload failed", "supabase storage is not configured"];

function isRateLimit(error: string) {
  return RATE_LIMIT_PHRASES.some((p) => error.toLowerCase().includes(p));
}
function isSupabaseFail(error: string) {
  return SUPABASE_FAIL_PHRASES.some((p) => error.toLowerCase().includes(p));
}

async function main() {
  const startTime = Date.now();
  let totalProcessed = 0;
  let totalFailed = 0;
  let totalCostUsd = 0;
  let batchNum = 0;
  let consecutiveRateLimits = 0;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Grade 5 ENGLISH Audio — Batch Runner`);
  console.log(`Batch size: ${BATCH_SIZE} | Max failures/batch: ${MAX_FAILURES_PER_BATCH}`);
  console.log(`${"=".repeat(60)}\n`);

  while (true) {
    batchNum++;
    const batchStart = Date.now();

    // Dry-run first to see how many remain
    const check = await processLessonAudioBatch({
      grade: 5,
      subject: "ENGLISH",
      limit: BATCH_SIZE,
      dryRun: true,
      voice: "alloy",
      provider: "openai",
    });

    if (check.inspected === 0) {
      console.log(`\n✓ No more PENDING rows. Processing complete.\n`);
      break;
    }

    console.log(`Batch ${batchNum}: ${check.inspected} rows queued (~$${check.estimatedCostUsd.toFixed(4)})`);

    // Process the batch
    const result = await processLessonAudioBatch({
      grade: 5,
      subject: "ENGLISH",
      limit: BATCH_SIZE,
      approved: true,
      voice: "alloy",
      provider: "openai",
    });

    totalProcessed += result.processed;
    totalFailed += result.failed;
    totalCostUsd += result.estimatedCostUsd;

    // Print each row result
    for (const row of result.rows) {
      const icon = row.status === "GENERATED" ? "✓" : row.status === "SKIPPED" ? "–" : "✗";
      const detail = row.url ? ` → ${row.url.slice(0, 70)}…` : row.error ? ` [${row.error}]` : "";
      console.log(`  ${icon} ${row.lessonId} (${row.status})${detail}`);
    }

    const batchMs = Date.now() - batchStart;
    console.log(`  Batch ${batchNum}: ${result.processed} generated, ${result.failed} failed, $${result.estimatedCostUsd.toFixed(4)}, ${(batchMs/1000).toFixed(1)}s`);

    // Stop rule: check for Supabase failures
    const supabaseFails = result.rows.filter((r) => r.error && isSupabaseFail(r.error));
    if (supabaseFails.length > 0) {
      console.error(`\n✗ STOP: Supabase upload failed on ${supabaseFails.length} row(s).`);
      console.error(`  First error: ${supabaseFails[0].error}`);
      console.error(`  Check Supabase storage health before retrying.`);
      process.exitCode = 1;
      break;
    }

    // Stop rule: check for repeated rate limits
    const rateLimitFails = result.rows.filter((r) => r.error && isRateLimit(r.error));
    if (rateLimitFails.length > 0) {
      consecutiveRateLimits++;
      console.warn(`  ⚠ Rate limit detected (${consecutiveRateLimits} consecutive)`);
      if (consecutiveRateLimits >= 2) {
        console.error(`\n✗ STOP: Repeated OpenAI rate limits. Wait and retry.`);
        process.exitCode = 1;
        break;
      }
      console.warn(`  Waiting 30s before next batch...`);
      await new Promise((r) => setTimeout(r, 30_000));
    } else {
      consecutiveRateLimits = 0;
    }

    // Stop rule: too many failures per batch
    if (result.failed > MAX_FAILURES_PER_BATCH) {
      console.error(`\n✗ STOP: ${result.failed} failures in batch ${batchNum} (limit: ${MAX_FAILURES_PER_BATCH}).`);
      console.error(`  Run retry command, investigate errors above, then re-run this script.`);
      process.exitCode = 1;
      break;
    }

    // Storage sanity check: no local paths
    const localPaths = result.rows.filter((r) => r.url?.startsWith("/generated-audio"));
    if (localPaths.length > 0) {
      console.error(`\n✗ STOP: ${localPaths.length} row(s) stored to local path (Supabase env missing?).`);
      process.exitCode = 1;
      break;
    }

    // Brief pause between batches to respect API rate limits
    await new Promise((r) => setTimeout(r, 1_500));
  }

  // Final queue state
  const finalState = await processLessonAudioBatch({
    grade: 5, subject: "ENGLISH", limit: 1, dryRun: true, voice: "alloy", provider: "openai",
  });

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(0);
  const generated = await prisma.lessonAudio.count({
    where: { status: "GENERATED", lesson: { grade: 5, subject: "ENGLISH" } },
  });
  const pending = await prisma.lessonAudio.count({
    where: { status: "PENDING", lesson: { grade: 5, subject: "ENGLISH" } },
  });
  const failed = await prisma.lessonAudio.count({
    where: { status: "FAILED", lesson: { grade: 5, subject: "ENGLISH" } },
  });
  const processing = await prisma.lessonAudio.count({
    where: { status: "PROCESSING", lesson: { grade: 5, subject: "ENGLISH" } },
  });

  // Sample 3 storageUrls to verify format
  const sample = await prisma.lessonAudio.findMany({
    where: { status: "GENERATED", lesson: { grade: 5, subject: "ENGLISH" } },
    orderBy: { generatedAt: "desc" },
    take: 3,
    select: { lessonId: true, storageUrl: true, voice: true, generatedAt: true },
  });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`FINAL STATE — Grade 5 ENGLISH`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  GENERATED:   ${generated}`);
  console.log(`  PENDING:     ${pending}`);
  console.log(`  PROCESSING:  ${processing}`);
  console.log(`  FAILED:      ${failed}`);
  console.log(`  Batches run: ${batchNum}`);
  console.log(`  Rows processed this run: ${totalProcessed}`);
  console.log(`  Rows failed this run:    ${totalFailed}`);
  console.log(`  Estimated cost this run: $${totalCostUsd.toFixed(4)}`);
  console.log(`  Total time:  ${elapsedSec}s`);
  console.log(`\nSample storageUrls (last 3 generated):`);
  for (const row of sample) {
    const isSupabase = row.storageUrl?.startsWith("https://") ?? false;
    const isLocal = row.storageUrl?.startsWith("/generated-audio") ?? false;
    console.log(`  ${isSupabase ? "✓" : isLocal ? "✗ LOCAL" : "?"} ${row.lessonId}`);
    console.log(`    ${row.storageUrl}`);
  }

  const allGood = generated === 180 && pending === 0 && failed === 0 && processing === 0;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`STATUS: ${allGood ? "✓ COMPLETE — safe to move to textbook foundation" : "⚠ INCOMPLETE — review above"}`);
  console.log(`${"=".repeat(60)}\n`);
}

main()
  .catch((err) => {
    console.error("\n✗ Uncaught error:", err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
