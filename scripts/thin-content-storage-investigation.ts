/**
 * scripts/thin-content-storage-investigation.ts
 *
 * Read-only. Informs the regenerate-in-place vs purge-and-rebuild decision
 * for thin/template-stub CurriculumContent rows.
 *
 * 1. Real attachment rate: does a thin lesson have any real StudentProgress
 *    (via ScheduledWork) or Assignment reference?
 * 2. Real storage math: payload size delta, thin vs full-depth.
 * 3. RagChunk contribution: does RagChunk size correlate with thin vs full
 *    lessons, or is it dominated by something else (e.g. orphaned chunks
 *    referencing deleted CurriculumContent rows)?
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/thin-content-storage-investigation.ts
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

const THIN_THRESHOLD = 300;

function extractLessonText(payload: any): string {
  const textParts: string[] = [];
  if (payload) {
    for (const key of ["title", "description", "objectives", "content", "summary", "lessonPlan"]) {
      const val = payload[key];
      if (typeof val === "string") textParts.push(val);
      else if (Array.isArray(val)) textParts.push(val.filter((v: any) => typeof v === "string").join(" "));
      else if (typeof val === "object" && val) textParts.push(JSON.stringify(val));
    }
  }
  return textParts.join(" ").toLowerCase();
}

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

async function main() {
  // ===== Classify the whole corpus by matchable-text length =====
  const allContent = await prisma.curriculumContent.findMany({
    select: { id: true, contentId: true, payload: true, grade: true, subject: true, status: true },
  });
  const thinIds: string[] = [];
  const fullIds: string[] = [];
  for (const c of allContent) {
    const len = extractLessonText(c.payload).length;
    if (len < THIN_THRESHOLD) thinIds.push(c.id);
    else fullIds.push(c.id);
  }
  console.log(`\n=== CORPUS CLASSIFICATION (matchable text, whole ${allContent.length}-row corpus) ===`);
  console.log(`  Thin (<${THIN_THRESHOLD} chars): ${thinIds.length}`);
  console.log(`  Full-depth (>=${THIN_THRESHOLD} chars): ${fullIds.length}`);

  // ===== Q1: real attachment rate for thin lessons =====
  const thinContentIds = await contentIdsFor(thinIds);
  const fullContentIds = await contentIdsFor(fullIds);

  const [scheduledForThin, assignmentsForThin, scheduledForFull, assignmentsForFull] = await Promise.all([
    prisma.scheduledWork.findMany({
      where: { contentId: { in: thinContentIds } },
      select: { id: true, contentId: true },
    }),
    prisma.assignment.count({ where: { contentId: { in: thinContentIds } } }),
    prisma.scheduledWork.findMany({
      where: { contentId: { in: fullContentIds } },
      select: { id: true, contentId: true },
    }),
    prisma.assignment.count({ where: { contentId: { in: fullContentIds } } }),
  ]);

  const swIdsForThin = scheduledForThin.map((s) => s.id);
  const progressForThin = swIdsForThin.length > 0
    ? await prisma.studentProgress.count({ where: { scheduledWorkId: { in: swIdsForThin } } })
    : 0;
  const distinctThinContentWithScheduledWork = new Set(scheduledForThin.map((s) => s.contentId)).size;

  const swIdsForFull = scheduledForFull.map((s) => s.id);
  const progressForFull = swIdsForFull.length > 0
    ? await prisma.studentProgress.count({ where: { scheduledWorkId: { in: swIdsForFull } } })
    : 0;
  const distinctFullContentWithScheduledWork = new Set(scheduledForFull.map((s) => s.contentId)).size;

  console.log(`\n=== Q1: REAL ATTACHMENT RATE ===`);
  console.log(`  Thin lessons (${thinIds.length}):`);
  console.log(`    Distinct thin lessons with >=1 ScheduledWork: ${distinctThinContentWithScheduledWork} (${((distinctThinContentWithScheduledWork / thinIds.length) * 100).toFixed(2)}%)`);
  console.log(`    Total ScheduledWork rows referencing thin lessons: ${scheduledForThin.length}`);
  console.log(`    Total StudentProgress rows attached (via those ScheduledWork rows): ${progressForThin}`);
  console.log(`    Total Assignment rows referencing thin lessons directly: ${assignmentsForThin}`);
  console.log(`  Full-depth lessons (${fullIds.length}), for comparison:`);
  console.log(`    Total ScheduledWork rows referencing full-depth lessons: ${scheduledForFull.length}`);
  console.log(`    Total StudentProgress rows attached: ${progressForFull}`);
  console.log(`    Total Assignment rows referencing full-depth lessons directly: ${assignmentsForFull}`);

  // ===== Q2: real storage size delta =====
  const sizeRows = await prisma.$queryRaw<Array<{ id: string; sz: number }>>`
    SELECT id, pg_column_size(payload) AS sz FROM "CurriculumContent"
  `;
  const sizeById = new Map(sizeRows.map((r) => [r.id, r.sz]));
  const thinSizes = thinIds.map((id) => sizeById.get(id) ?? 0).sort((a, b) => a - b);
  const fullSizes = fullIds.map((id) => sizeById.get(id) ?? 0).sort((a, b) => a - b);
  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  console.log(`\n=== Q2: REAL STORAGE SIZE (pg_column_size of payload column, bytes) ===`);
  console.log(`  Thin:  avg=${avg(thinSizes).toFixed(0)}  median=${percentile(thinSizes, 0.5)}  p90=${percentile(thinSizes, 0.9)}  max=${thinSizes[thinSizes.length - 1] ?? 0}`);
  console.log(`  Full:  avg=${avg(fullSizes).toFixed(0)}  median=${percentile(fullSizes, 0.5)}  p90=${percentile(fullSizes, 0.9)}  max=${fullSizes[fullSizes.length - 1] ?? 0}`);
  console.log(`  Per-row delta (full avg - thin avg): ${(avg(fullSizes) - avg(thinSizes)).toFixed(0)} bytes`);
  console.log(`  Total payload bytes currently in thin rows: ${thinSizes.reduce((a, b) => a + b, 0).toLocaleString()}`);
  console.log(`  Total payload bytes currently in full rows: ${fullSizes.reduce((a, b) => a + b, 0).toLocaleString()}`);
  console.log(`  Projected extra bytes if all ${thinIds.length} thin rows were regenerated to full-depth avg size: ~${((avg(fullSizes) - avg(thinSizes)) * thinIds.length).toLocaleString()} bytes`);

  // Whole-table sizes for context
  const tableSizes = await prisma.$queryRaw<Array<{ table: string; total_bytes: bigint }>>`
    SELECT relname AS table, pg_total_relation_size(relid) AS total_bytes
    FROM pg_catalog.pg_statio_user_tables
    WHERE relname IN ('CurriculumContent', 'RagChunk')
    ORDER BY total_bytes DESC
  `;
  console.log(`\n  Whole-table sizes (pg_total_relation_size, includes indexes):`);
  for (const row of tableSizes) {
    console.log(`    ${row.table}: ${(Number(row.total_bytes) / 1024 / 1024).toFixed(1)} MB`);
  }

  // ===== Q3: RagChunk contribution =====
  const ragRows = await prisma.$queryRaw<Array<{ sourceId: string; chunkCount: bigint; totalContentBytes: bigint }>>`
    SELECT "sourceId", COUNT(*)::bigint AS "chunkCount", SUM(pg_column_size(content))::bigint AS "totalContentBytes"
    FROM "RagChunk"
    WHERE "sourceType" = 'curriculum_content'
    GROUP BY "sourceId"
  `;
  const ragBySourceId = new Map(ragRows.map((r) => [r.sourceId, { chunkCount: Number(r.chunkCount), bytes: Number(r.totalContentBytes) }]));

  const existingIds = new Set(allContent.map((c) => c.id));
  let orphanedChunkRows = 0;
  let orphanedBytes = 0;
  let thinChunkRows = 0;
  let thinChunkBytes = 0;
  let fullChunkRows = 0;
  let fullChunkBytes = 0;
  const thinIdSet = new Set(thinIds);

  for (const [sourceId, stats] of ragBySourceId.entries()) {
    if (!existingIds.has(sourceId)) {
      orphanedChunkRows += stats.chunkCount;
      orphanedBytes += stats.bytes;
    } else if (thinIdSet.has(sourceId)) {
      thinChunkRows += stats.chunkCount;
      thinChunkBytes += stats.bytes;
    } else {
      fullChunkRows += stats.chunkCount;
      fullChunkBytes += stats.bytes;
    }
  }

  const totalChunkRows = await prisma.ragChunk.count({ where: { sourceType: "curriculum_content" } });
  const EMBEDDING_BYTES_PER_ROW = 1536 * 4; // pgvector(1536) raw float4 storage, plus index overhead not counted here

  console.log(`\n=== Q3: RAGCHUNK CONTRIBUTION ===`);
  console.log(`  Total curriculum_content-type RagChunk rows: ${totalChunkRows}`);
  console.log(`  Orphaned (sourceId no longer exists in CurriculumContent): ${orphanedChunkRows} rows, ${(orphanedBytes / 1024).toFixed(1)} KB text content`);
  console.log(`  Attached to a THIN lesson: ${thinChunkRows} rows, ${(thinChunkBytes / 1024).toFixed(1)} KB text content`);
  console.log(`  Attached to a FULL-DEPTH lesson: ${fullChunkRows} rows, ${(fullChunkBytes / 1024).toFixed(1)} KB text content`);
  console.log(`  Embedding storage per chunk (fixed, vector(1536) float4): ~${EMBEDDING_BYTES_PER_ROW} bytes/row regardless of source text length`);
  console.log(`  Estimated embedding-only bytes tied to thin lessons: ~${((thinChunkRows * EMBEDDING_BYTES_PER_ROW) / 1024).toFixed(1)} KB`);
  console.log(`  Estimated embedding-only bytes tied to full lessons: ~${((fullChunkRows * EMBEDDING_BYTES_PER_ROW) / 1024).toFixed(1)} KB`);
  console.log(`  Estimated embedding-only bytes tied to orphaned chunks: ~${((orphanedChunkRows * EMBEDDING_BYTES_PER_ROW) / 1024).toFixed(1)} KB`);

  await prisma.$disconnect();
}

async function contentIdsFor(ids: string[]): Promise<string[]> {
  // ScheduledWork/Assignment.contentId reference CurriculumContent.contentId (the slug), not .id
  const rows = await prisma.curriculumContent.findMany({ where: { id: { in: ids } }, select: { contentId: true } });
  return rows.map((r) => r.contentId);
}

main().catch((err) => {
  console.error("Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
