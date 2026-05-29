/**
 * scripts/generate-scaffolds.ts  — NR-14B-ii
 *
 * Reads the scaffold queue from scripts/data/scaffold-queue.json,
 * generates scaffold variants for each lesson, and upserts them
 * into LessonVariant (variantType='scaffold').
 *
 * Design:
 *   - Idempotent: skips lessons that already have a scaffold variant
 *   - Batched: processes N lessons per run (default 25)
 *   - 3-second gap between generations (connection-pool discipline)
 *   - Quality gate from generateScaffold() — skipped lessons are logged
 *   - Does NOT remove items from the queue JSON; run repeatedly until queue drains
 *
 * Run (repeat until done):
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-scaffolds.ts --limit 25
 *
 * Flags:
 *   --limit N     Process at most N lessons (default 25)
 *   --dry-run     Print what would be generated without calling AI
 *   --subject X   Filter queue to subject (e.g. MATH)
 *   --grade N     Filter queue to grade
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { generateScaffold } from "../lib/adaptive/generateScaffold";
import type { ScaffoldQueueItem } from "./scaffold-priority";

const prisma = new PrismaClient();
const BATCH_GAP_MS = 3000; // 3-second gap between AI calls

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1] ??
    (args.includes("--limit") ? args[args.indexOf("--limit") + 1] : "25");
  const limit = parseInt(limitArg, 10);
  const subjectFilter = args.find((a) => a.startsWith("--subject="))?.split("=")[1] ??
    (args.includes("--subject") ? args[args.indexOf("--subject") + 1] : undefined);
  const gradeFilter = args.find((a) => a.startsWith("--grade="))?.split("=")[1] ??
    (args.includes("--grade") ? args[args.indexOf("--grade") + 1] : undefined);

  console.log(`\n🏗  NR-14B-ii: generate-scaffolds  limit=${limit}${dryRun ? "  DRY RUN" : ""}${subjectFilter ? `  subject=${subjectFilter}` : ""}${gradeFilter ? `  grade=${gradeFilter}` : ""}`);

  // Load queue
  const queuePath = join(process.cwd(), "scripts", "data", "scaffold-queue.json");
  if (!existsSync(queuePath)) {
    console.error(`  ERROR: Queue not found at ${queuePath}`);
    console.error("  Run: npx tsx scripts/scaffold-priority.ts --mode heuristic --limit 400");
    process.exit(1);
  }

  const queueFile = JSON.parse(readFileSync(queuePath, "utf8")) as {
    mode: string;
    builtAt: string;
    queue: ScaffoldQueueItem[];
  };

  let queue = queueFile.queue;
  console.log(`  Queue loaded: ${queue.length} items (mode=${queueFile.mode}, built ${queueFile.builtAt})`);

  // Apply optional filters
  if (subjectFilter) queue = queue.filter((item) => item.subject === subjectFilter);
  if (gradeFilter) queue = queue.filter((item) => item.grade === parseInt(gradeFilter, 10));

  // Find already-scaffolded lessons and skip them
  const lessonIds = queue.map((item) => item.lessonId);
  const existingVariants = await prisma.lessonVariant.findMany({
    where: {
      lessonId: { in: lessonIds },
      variantType: { in: ["scaffold", "simplified"] },
    },
    select: { lessonId: true },
  });
  const alreadyScaffolded = new Set(existingVariants.map((v) => v.lessonId));
  const pending = queue.filter((item) => !alreadyScaffolded.has(item.lessonId));

  console.log(`  Already scaffolded: ${alreadyScaffolded.size}  |  Pending: ${pending.length}`);

  const batch = pending.slice(0, limit);
  console.log(`  Processing batch of ${batch.length}...\n`);

  if (dryRun) {
    console.log("  DRY RUN — would generate:");
    batch.forEach((item) =>
      console.log(`    ${item.subject} G${item.grade} — "${item.title}"`)
    );
    return;
  }

  let generated = 0;
  let skippedQuality = 0;
  let skippedError = 0;

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    const progress = `[${i + 1}/${batch.length}]`;

    try {
      // Load the lesson body from CurriculumContent
      const content = await prisma.curriculumContent.findUnique({
        where: { id: item.lessonId },
        select: { payload: true },
      });

      if (!content) {
        console.warn(`  ${progress} SKIP (not found): ${item.lessonId}`);
        skippedError++;
        continue;
      }

      // Extract body from payload (same pattern as resolveScheduledLessonContext)
      const payload = content.payload as {
        body?: string | null;
        body_standard?: string | null;
        body_block?: string | null;
      };
      const parentBody =
        payload.body_standard ?? payload.body_block ?? payload.body ?? "";

      if (!parentBody || parentBody.length < 200) {
        console.warn(`  ${progress} SKIP (body too short): ${item.subject} G${item.grade} "${item.title}"`);
        skippedError++;
        continue;
      }

      console.log(`  ${progress} Generating: ${item.subject} G${item.grade} — "${item.title}"`);

      const result = await generateScaffold({
        lessonId: item.lessonId,
        parentBody,
        grade: item.grade,
        subject: item.subject,
        title: item.title,
      });

      if (!result) {
        console.warn(
          `  ${progress} SKIP (quality gate after 2 attempts): ${item.subject} G${item.grade} "${item.title}"`
        );
        skippedQuality++;
        continue;
      }

      // Upsert: if a scaffold already exists somehow, overwrite with newer version
      const existing = await prisma.lessonVariant.findFirst({
        where: { lessonId: item.lessonId, variantType: "scaffold" },
        select: { id: true },
      });

      if (existing) {
        await prisma.lessonVariant.update({
          where: { id: existing.id },
          data: { body: result.body },
        });
      } else {
        await prisma.lessonVariant.create({
          data: {
            lessonId: item.lessonId,
            variantType: "scaffold",
            body: result.body,
          },
        });
      }

      generated++;
      console.log(
        `  ${progress} ✅ ${result.wordCount}w (${Math.round(result.ratioOfParent * 100)}% of parent)`
      );
    } catch (err) {
      console.error(`  ${progress} ERROR:`, err);
      skippedError++;
    }

    // Rate-limit: gap between calls (skip after last item)
    if (i < batch.length - 1) {
      await sleep(BATCH_GAP_MS);
    }
  }

  const remaining = pending.length - batch.length;

  console.log(`\n  ─────────────────────────────────`);
  console.log(`  Scaffolds generated:     ${generated}`);
  console.log(`  Skipped (quality gate):  ${skippedQuality}`);
  console.log(`  Skipped (error/missing): ${skippedError}`);
  console.log(`  Remaining in queue:      ${remaining}`);
  console.log(`  ─────────────────────────────────`);

  if (remaining > 0) {
    console.log(`\n  Re-run to continue: npx tsx scripts/generate-scaffolds.ts --limit ${limit}`);
  } else {
    console.log("\n  Queue complete! 🎉");
  }
}

main()
  .catch((e) => {
    console.error("generate-scaffolds failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
