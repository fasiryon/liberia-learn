/**
 * scripts/scaffold-priority.ts  — NR-14B-ii
 *
 * Builds the priority queue for scaffold generation.
 *
 * Three modes:
 *
 *   MODE A — data-driven (when StuckEvent data exists, post-pilot):
 *     Ranks lessons by stuck-event count. Lessons triggering the most
 *     stuck signals get scaffolds first. Skip lessons already scaffolded.
 *
 *   MODE B — heuristic (current state — no StuckEvent traffic yet):
 *     Targets the lessons most likely to cause stuck signals:
 *     - MATH + SCIENCE subjects (abstraction-heavy)
 *     - Grades 4-9 (difficulty ramp where concepts become abstract)
 *     - Unit-openers: the first lesson in each unit (min orderInUnit)
 *       where students encounter new concepts for the first time
 *     - Skip lessons that already have a scaffold variant
 *
 *   MODE C — requeue-skipped (after a quality gate fix):
 *     Re-queues lessons that were previously skipped due to the ratio
 *     quality gate (now removed). These are long, hard lessons that had
 *     correct short scaffolds rejected. Detects them by checking which
 *     lessons have NO scaffold variant but ARE in the heuristic priority
 *     range and have a parent body ≥ 300 words (not a stub).
 *     Excludes lessons that already have a scaffold variant.
 *
 * Output:
 *   Writes a JSON file to scripts/data/scaffold-queue.json
 *   that scripts/generate-scaffolds.ts reads.
 *
 * Run:
 *   # Heuristic mode (default):
 *   npx dotenv -e .env.production -- npx tsx scripts/scaffold-priority.ts --mode heuristic --limit 400
 *
 *   # Data-driven (after pilot traffic):
 *   npx dotenv -e .env.production -- npx tsx scripts/scaffold-priority.ts --mode data --limit 400
 *
 *   # Re-queue previously-skipped long hard lessons (after quality gate fix):
 *   npx dotenv -e .env.production -- npx tsx scripts/scaffold-priority.ts --mode requeue-skipped --limit 50
 */

import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

// Heuristic priority subjects and grade range
const HEURISTIC_SUBJECTS = ["MATH", "SCIENCE"];
const HEURISTIC_GRADE_MIN = 4;
const HEURISTIC_GRADE_MAX = 9;

export type ScaffoldQueueItem = {
  lessonId: string;       // CurriculumContent.id
  contentId: string;      // CurriculumContent.contentId
  title: string;
  grade: number;
  subject: string;
  unitId: string | null;
  orderInUnit: number | null;
  priority: number;       // higher = more urgent
};

async function modeHeuristic(limit: number): Promise<ScaffoldQueueItem[]> {
  console.log(`  [heuristic] Targeting ${HEURISTIC_SUBJECTS.join("+")} G${HEURISTIC_GRADE_MIN}-G${HEURISTIC_GRADE_MAX} unit-openers`);

  // Find the minimum orderInUnit per (subject, grade, unitId) group —
  // these are the unit-openers where students first encounter new concepts
  const lessons = await prisma.curriculumContent.findMany({
    where: {
      status: { in: ["published", "APPROVED"] },
      subject: { in: HEURISTIC_SUBJECTS },
      grade: { gte: HEURISTIC_GRADE_MIN, lte: HEURISTIC_GRADE_MAX },
      orderInUnit: { not: null },
      // Exclude lessons that already have a scaffold or simplified variant
      NOT: {
        id: {
          in: await prisma.lessonVariant
            .findMany({
              where: { variantType: { in: ["scaffold", "simplified"] } },
              select: { lessonId: true },
            })
            .then((variants) => variants.map((v) => v.lessonId)),
        },
      },
    },
    select: {
      id: true,
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      unitId: true,
      orderInUnit: true,
    },
    orderBy: [{ subject: "asc" }, { grade: "asc" }, { unitId: "asc" }, { orderInUnit: "asc" }],
  });

  console.log(`  [heuristic] Found ${lessons.length} candidate lessons (no scaffold yet, in priority range)`);

  // Group by (subject, grade, unitId) and pick the unit-opener (min orderInUnit)
  type LessonRow = typeof lessons[number];
  const unitOpeners = new Map<string, LessonRow>();

  for (const lesson of lessons) {
    const key = `${lesson.subject}:${lesson.grade}:${lesson.unitId ?? "none"}`;
    const existing = unitOpeners.get(key);
    if (!existing || (lesson.orderInUnit ?? 999) < (existing.orderInUnit ?? 999)) {
      unitOpeners.set(key, lesson);
    }
  }

  console.log(`  [heuristic] Unit-openers identified: ${unitOpeners.size}`);

  // If we have more unit-openers than the limit, prioritise:
  // MATH before SCIENCE, lower grades before higher
  const sorted = Array.from(unitOpeners.values()).sort((a, b) => {
    const subjectOrder = HEURISTIC_SUBJECTS.indexOf(a.subject) - HEURISTIC_SUBJECTS.indexOf(b.subject);
    if (subjectOrder !== 0) return subjectOrder;
    return a.grade - b.grade;
  });

  const queue: ScaffoldQueueItem[] = sorted.slice(0, limit).map((lesson, idx) => ({
    lessonId: lesson.id,
    contentId: lesson.contentId,
    title: lesson.title ?? `${lesson.subject} G${lesson.grade} Lesson`,
    grade: lesson.grade,
    subject: lesson.subject,
    unitId: lesson.unitId,
    orderInUnit: lesson.orderInUnit,
    priority: sorted.length - idx, // higher index = lower priority
  }));

  return queue;
}

/**
 * MODE C — requeue-skipped
 *
 * Finds lessons that:
 *   - Are in the heuristic priority range (MATH+SCIENCE G4-G9)
 *   - Have NO scaffold/simplified variant yet (i.e. were previously skipped)
 *   - Have a parent body ≥ 300 words (not a stub — real lessons that had
 *     correct scaffolds rejected by the old ratio gate)
 *
 * These are exactly the long hard lessons the ratio gate wrongly rejected.
 */
async function modeRequeueSkipped(limit: number): Promise<ScaffoldQueueItem[]> {
  console.log(`  [requeue-skipped] Finding long hard lessons previously skipped by ratio gate...`);

  // Get already-scaffolded IDs so we never re-queue them
  const scaffolded = new Set(
    (
      await prisma.lessonVariant.findMany({
        where: { variantType: { in: ["scaffold", "simplified"] } },
        select: { lessonId: true },
      })
    ).map((v) => v.lessonId)
  );

  console.log(`  [requeue-skipped] ${scaffolded.size} lessons already have scaffolds — excluded`);

  // Pull all heuristic-range lessons without scaffolds, with their body
  const candidates = await prisma.curriculumContent.findMany({
    where: {
      status: { in: ["published", "APPROVED"] },
      subject: { in: HEURISTIC_SUBJECTS },
      grade: { gte: HEURISTIC_GRADE_MIN, lte: HEURISTIC_GRADE_MAX },
      NOT: { id: { in: Array.from(scaffolded) } },
    },
    select: {
      id: true,
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      unitId: true,
      orderInUnit: true,
      payload: true,
    },
    orderBy: [{ subject: "asc" }, { grade: "asc" }, { unitId: "asc" }, { orderInUnit: "asc" }],
  });

  console.log(`  [requeue-skipped] ${candidates.length} unscaffolded lessons in priority range`);

  // Filter to those with a real parent body (≥300 words) — stubs are excluded
  // because the new stub guard in generateScaffold will refuse them anyway
  const MIN_PARENT_WORDS = 300;
  function countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

  const longLessons = candidates.filter((c) => {
    const payload = c.payload as {
      body?: string | null;
      body_standard?: string | null;
      body_block?: string | null;
    } | null;
    const body =
      (payload?.body_standard ?? payload?.body_block ?? payload?.body ?? "").trim();
    return countWords(body) >= MIN_PARENT_WORDS;
  });

  console.log(
    `  [requeue-skipped] ${longLessons.length} lessons have parent body ≥${MIN_PARENT_WORDS} words (previously skipped by ratio gate)`
  );

  const queue: ScaffoldQueueItem[] = longLessons.slice(0, limit).map((lesson, idx) => ({
    lessonId: lesson.id,
    contentId: lesson.contentId,
    title: lesson.title ?? `${lesson.subject} G${lesson.grade} Lesson`,
    grade: lesson.grade,
    subject: lesson.subject,
    unitId: lesson.unitId,
    orderInUnit: lesson.orderInUnit,
    priority: longLessons.length - idx,
  }));

  return queue;
}

async function modeData(limit: number): Promise<ScaffoldQueueItem[]> {
  console.log("  [data-driven] Ranking lessons by stuck event count...");

  // Check if we have any StuckEvent data
  const stuckCount = await prisma.stuckEvent.count();
  if (stuckCount === 0) {
    console.warn("  [data-driven] WARNING: No StuckEvent data found. Run --mode heuristic instead.");
    return [];
  }

  console.log(`  [data-driven] ${stuckCount} StuckEvents available for ranking`);

  // Group StuckEvents by lessonId, get counts
  const stuckGroups = await prisma.stuckEvent.groupBy({
    by: ["lessonId"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit * 2, // take extra to account for already-scaffolded lessons
  });

  // Get already-scaffolded lesson IDs
  const scaffolded = new Set(
    (
      await prisma.lessonVariant.findMany({
        where: { variantType: { in: ["scaffold", "simplified"] } },
        select: { lessonId: true },
      })
    ).map((v) => v.lessonId)
  );

  // Resolve lessonIds to CurriculumContent
  const lessonIds = stuckGroups
    .filter((g) => !scaffolded.has(g.lessonId))
    .slice(0, limit)
    .map((g) => g.lessonId);

  const contents = await prisma.curriculumContent.findMany({
    where: { id: { in: lessonIds } },
    select: {
      id: true,
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      unitId: true,
      orderInUnit: true,
    },
  });

  const contentMap = new Map(contents.map((c) => [c.id, c]));

  const queue: ScaffoldQueueItem[] = lessonIds
    .map((id, idx) => {
      const content = contentMap.get(id);
      const stuckEntry = stuckGroups.find((g) => g.lessonId === id);
      if (!content) return null;
      return {
        lessonId: content.id,
        contentId: content.contentId,
        title: content.title ?? `${content.subject} G${content.grade}`,
        grade: content.grade,
        subject: content.subject,
        unitId: content.unitId,
        orderInUnit: content.orderInUnit,
        priority: (stuckEntry?._count.id ?? 0) * 10 - idx,
      } satisfies ScaffoldQueueItem;
    })
    .filter(Boolean) as ScaffoldQueueItem[];

  return queue;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = (args.find((a) => a.startsWith("--mode="))?.split("=")[1] ??
    (args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "heuristic")) as
    | "heuristic"
    | "data"
    | "requeue-skipped";
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1] ??
    (args.includes("--limit") ? args[args.indexOf("--limit") + 1] : "400");
  const limit = parseInt(limitArg, 10);

  console.log(`\n🎯 NR-14B-ii: scaffold-priority  mode=${mode}  limit=${limit}`);

  let queue: ScaffoldQueueItem[];
  if (mode === "data") {
    queue = await modeData(limit);
  } else if (mode === "requeue-skipped") {
    queue = await modeRequeueSkipped(limit);
  } else {
    queue = await modeHeuristic(limit);
  }

  console.log(`\n  Queue built: ${queue.length} lessons`);

  if (queue.length === 0) {
    console.log("  Nothing to queue. Either all lessons are scaffolded or no data available.");
    return;
  }

  // Write queue to scripts/data/
  const dataDir = join(process.cwd(), "scripts", "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const outPath = join(dataDir, "scaffold-queue.json");
  writeFileSync(outPath, JSON.stringify({ mode, builtAt: new Date().toISOString(), queue }, null, 2));

  console.log(`  ✅ Queue written to scripts/data/scaffold-queue.json`);
  console.log(`\n  Sample (first 5):`);
  queue.slice(0, 5).forEach((item) => {
    console.log(`    ${item.subject} G${item.grade} — "${item.title}" (unit: ${item.unitId ?? "none"})`);
  });

  // Coverage stats for heuristic mode
  if (mode === "heuristic") {
    const subjectCounts = new Map<string, number>();
    const gradeCounts = new Map<number, number>();
    for (const item of queue) {
      subjectCounts.set(item.subject, (subjectCounts.get(item.subject) ?? 0) + 1);
      gradeCounts.set(item.grade, (gradeCounts.get(item.grade) ?? 0) + 1);
    }
    console.log("\n  Subject breakdown:");
    for (const [subj, count] of subjectCounts) console.log(`    ${subj}: ${count}`);
    console.log("  Grade breakdown:");
    for (const [grade, count] of Array.from(gradeCounts).sort((a, b) => a[0] - b[0])) {
      console.log(`    G${grade}: ${count}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("scaffold-priority failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
