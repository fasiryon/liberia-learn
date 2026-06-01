/**
 * scripts/generate-code-exercises.ts  — NR-14D Phase 2
 *
 * Generates Python coding exercises for CS lessons and persists only those
 * whose reference solution passes self-validation via Judge0.
 *
 * Design:
 *   - Idempotent: skips lessons that already have a CodeExercise
 *   - Throttled: 30-second gap between exercises (Judge0 budget discipline)
 *   - Hard cap via --limit (prevents runaway budget burn)
 *   - Reports generated / failed-validation / skipped after each batch
 *
 * Judge0 free tier: ~50 submissions/day → ~16 validated exercises/day
 * (3 test cases × 1 validation run per exercise = 3 submissions per exercise)
 *
 * Run (pilot batch):
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-code-exercises.ts \
 *     --grades G5,G6 --limit 15 --difficulty intro
 *
 * Flags:
 *   --grades G5,G6,G7   Grade filter (comma-separated, G-prefixed)
 *   --limit N           Max exercises to generate per run (default 16)
 *   --difficulty        intro | guided | challenge (default intro)
 *   --dry-run           Print candidates without generating
 *   --lesson-filter     Substring filter on lesson title (case-insensitive)
 */

import { PrismaClient } from "@prisma/client";
import { generateCodeExercise } from "../lib/exercises/generateCodeExercise";

if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const prisma = new PrismaClient();
const GAP_MS = 30_000; // 30-second gap — Judge0 rate limit discipline

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Python-specific title keywords — target lessons where a coding exercise fits
const PYTHON_TITLE_KEYWORDS = [
  "python", "coding", "code", "programming", "program",
  "function", "loop", "algorithm", "data structure", "variable",
  "class", "object", "list", "dictionary", "recursion",
  "input", "output", "debug", "syntax",
];

function isPythonLesson(title: string, body: string): boolean {
  const t = title.toLowerCase();
  const b = body.slice(0, 2000).toLowerCase();
  return PYTHON_TITLE_KEYWORDS.some((kw) => t.includes(kw) || b.includes(kw));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const difficulty = (args.find((a) => a.startsWith("--difficulty="))?.split("=")[1] ??
    (args.includes("--difficulty") ? args[args.indexOf("--difficulty") + 1] : "intro")) as
    | "intro"
    | "guided"
    | "challenge";

  const limitArg =
    args.find((a) => a.startsWith("--limit="))?.split("=")[1] ??
    (args.includes("--limit") ? args[args.indexOf("--limit") + 1] : "16");
  const limit = parseInt(limitArg, 10);

  const gradesArg =
    args.find((a) => a.startsWith("--grades="))?.split("=")[1] ??
    (args.includes("--grades") ? args[args.indexOf("--grades") + 1] : undefined);
  const gradeNumbers = gradesArg
    ? gradesArg.split(",").map((g) => parseInt(g.replace(/^G/, ""), 10))
    : [5, 6, 7, 8, 9];

  const lessonFilter =
    args.find((a) => a.startsWith("--lesson-filter="))?.split("=")[1] ??
    (args.includes("--lesson-filter") ? args[args.indexOf("--lesson-filter") + 1] : undefined);

  console.log(
    `\nNR-14D: generate-code-exercises  grades=G${gradeNumbers.join(",G")}  limit=${limit}  difficulty=${difficulty}${dryRun ? "  DRY RUN" : ""}${lessonFilter ? `  filter="${lessonFilter}"` : ""}`
  );

  // Find all CS lessons in target grades
  const lessons = await prisma.curriculumContent.findMany({
    where: {
      subject: "COMPUTER_SCIENCE",
      grade: { in: gradeNumbers },
      status: { in: ["published", "APPROVED"] },
    },
    select: { id: true, contentId: true, grade: true, title: true, payload: true },
    orderBy: [{ grade: "asc" }, { title: "asc" }],
  });

  // Find lessons that already have a CodeExercise (idempotency)
  const existingExercises = await prisma.codeExercise.findMany({
    where: { lessonId: { in: lessons.map((l) => l.id) } },
    select: { lessonId: true },
  });
  const alreadyDone = new Set(existingExercises.map((e) => e.lessonId));

  // Filter to Python-relevant lessons without existing exercises
  let candidates = lessons.filter((l) => {
    if (alreadyDone.has(l.id)) return false;
    const body = ((l.payload as Record<string, unknown>)?.body as string) ?? "";
    if (!isPythonLesson(l.title ?? "", body)) return false;
    if (lessonFilter && !(l.title ?? "").toLowerCase().includes(lessonFilter.toLowerCase()))
      return false;
    return true;
  });

  console.log(
    `  Candidates: ${candidates.length} lessons (${alreadyDone.size} already have exercises)`
  );

  if (dryRun) {
    console.log("\n  Would generate:");
    for (const c of candidates.slice(0, limit)) {
      console.log(`    G${c.grade}: ${c.title}`);
    }
    await prisma.$disconnect();
    return;
  }

  candidates = candidates.slice(0, limit);

  let generated = 0;
  let failedValidation = 0;
  let errors = 0;

  for (let i = 0; i < candidates.length; i++) {
    const lesson = candidates[i];
    const body = ((lesson.payload as Record<string, unknown>)?.body as string) ?? "";

    console.log(`\n  [${i + 1}/${candidates.length}] G${lesson.grade}: ${lesson.title}`);

    const result = await generateCodeExercise({
      lessonId: lesson.id,
      lessonTitle: lesson.title ?? "Untitled",
      lessonBody: body,
      grade: lesson.grade,
      difficulty,
    });

    if (result.success === false) {
      if (result.reason.startsWith("reference_solution_failed")) {
        failedValidation++;
        console.log(`    SKIPPED (validation failed): ${result.reason}`);
      } else {
        errors++;
        console.log(`    ERROR: ${result.reason}`);
      }
    } else {
      const { exercise } = result;
      const promptId = `${lesson.contentId}:code:${difficulty}:1`;

      await prisma.codeExercise.upsert({
        where: { promptId },
        create: {
          lessonId: lesson.id,
          promptId,
          title: exercise.title,
          description: exercise.description,
          starterCode: exercise.starterCode,
          referenceSolution: exercise.referenceSolution,
          languageId: 71,
          testCases: exercise.testCases,
          difficulty,
          validatedAt: new Date(),
        },
        update: {
          title: exercise.title,
          description: exercise.description,
          starterCode: exercise.starterCode,
          referenceSolution: exercise.referenceSolution,
          testCases: exercise.testCases,
          difficulty,
          validatedAt: new Date(),
        },
      });

      generated++;
      console.log(`    OK — "${exercise.title}" (${exercise.testCases.length} test cases)`);
    }

    // Throttle — respect Judge0 budget; skip sleep after last item
    if (i < candidates.length - 1) {
      console.log(`    (waiting ${GAP_MS / 1000}s before next…)`);
      await sleep(GAP_MS);
    }
  }

  console.log(`
  ─────────────────────────────────
  Results:
    Generated:          ${generated}
    Failed validation:  ${failedValidation}  (broken reference — skipped correctly)
    Errors:             ${errors}
  ─────────────────────────────────`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
