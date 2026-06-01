/**
 * scripts/generate-ai-literacy.ts  — NR-14D Phase 4/5
 *
 * Generates AI literacy exercises for CS lessons that mention AI concepts.
 * Four exercise types: prompt_engineering | bias_detection | ethics_scenario | output_critique
 * Rotates through types to give each lesson a variety.
 *
 * No Judge0 needed — pure LLM generation. Respects 3-second gap.
 * Idempotent — skips lessons with existing exercises of the same type.
 *
 * Run:
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-ai-literacy.ts \
 *     --limit 25
 *
 * Flags:
 *   --limit N             Max exercises per run (default 25)
 *   --grades G4,G5,...    Grade filter (default: all G4-G12)
 *   --type ethics_scenario  Generate only one type (default: rotate)
 *   --dry-run             Print candidates without generating
 *   --lesson-filter X     Substring filter on lesson title
 */

import { PrismaClient } from "@prisma/client";
import { generateAILiteracy } from "../lib/exercises/generateAILiteracy";
import type { AILiteracyExerciseType } from "../lib/exercises/generateAILiteracy";

if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

const prisma = new PrismaClient();
const GAP_MS = 3_000; // 3-second gap between AI calls

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ALL_TYPES: AILiteracyExerciseType[] = [
  "prompt_engineering",
  "bias_detection",
  "ethics_scenario",
  "output_critique",
];

// AI-related keywords in lesson titles/body
const AI_KEYWORDS = [
  "artificial intelligence", "machine learning", "ai ", "neural network",
  "algorithm", "data science", "recommendation", "bias", "ethics",
  "automation", "computer vision", "natural language", "deep learning",
  "robotics", "chatbot", "generative", "prediction", "classification",
];

function isAILesson(title: string, body: string): boolean {
  const t = title.toLowerCase();
  const b = body.slice(0, 3000).toLowerCase();
  return AI_KEYWORDS.some((kw) => t.includes(kw) || b.includes(kw));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  const limitArg =
    args.find((a) => a.startsWith("--limit="))?.split("=")[1] ??
    (args.includes("--limit") ? args[args.indexOf("--limit") + 1] : "25");
  const limit = parseInt(limitArg, 10);

  const gradesArg =
    args.find((a) => a.startsWith("--grades="))?.split("=")[1] ??
    (args.includes("--grades") ? args[args.indexOf("--grades") + 1] : undefined);
  const gradeNumbers = gradesArg
    ? gradesArg.split(",").map((g) => parseInt(g.replace(/^G/, ""), 10))
    : [4, 5, 6, 7, 8, 9, 10, 11, 12];

  const typeFilter = (args.find((a) => a.startsWith("--type="))?.split("=")[1] ??
    (args.includes("--type") ? args[args.indexOf("--type") + 1] : undefined)) as
    | AILiteracyExerciseType
    | undefined;

  const lessonFilter =
    args.find((a) => a.startsWith("--lesson-filter="))?.split("=")[1] ??
    (args.includes("--lesson-filter") ? args[args.indexOf("--lesson-filter") + 1] : undefined);

  console.log(
    `\nNR-14D: generate-ai-literacy  grades=G${gradeNumbers.join(",G")}  limit=${limit}${typeFilter ? `  type=${typeFilter}` : "  type=rotate"}${dryRun ? "  DRY RUN" : ""}${lessonFilter ? `  filter="${lessonFilter}"` : ""}`
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

  // Find existing AI literacy exercises
  const existingExercises = await prisma.aILiteracyExercise.findMany({
    where: { lessonId: { in: lessons.map((l) => l.id) } },
    select: { lessonId: true, type: true },
  });
  const existingByLesson = new Map<string, Set<string>>();
  for (const e of existingExercises) {
    if (!existingByLesson.has(e.lessonId)) existingByLesson.set(e.lessonId, new Set());
    existingByLesson.get(e.lessonId)!.add(e.type);
  }

  // Build candidate list: (lesson, type) pairs that don't exist yet
  type Candidate = { lesson: typeof lessons[0]; body: string; type: AILiteracyExerciseType };
  const candidates: Candidate[] = [];

  for (const lesson of lessons) {
    const body = ((lesson.payload as Record<string, unknown>)?.body as string) ?? "";
    if (!isAILesson(lesson.title ?? "", body)) continue;
    if (lessonFilter && !(lesson.title ?? "").toLowerCase().includes(lessonFilter.toLowerCase()))
      continue;

    const existingTypes = existingByLesson.get(lesson.id) ?? new Set();
    const typesToGenerate = typeFilter
      ? ([typeFilter] as AILiteracyExerciseType[])
      : ALL_TYPES;

    for (const type of typesToGenerate) {
      if (!existingTypes.has(type)) {
        candidates.push({ lesson, body, type });
      }
    }
  }

  console.log(
    `  AI-relevant lessons: ${new Set(candidates.map((c) => c.lesson.id)).size}`
  );
  console.log(
    `  Exercise slots available: ${candidates.length} (${existingExercises.length} already generated)`
  );

  if (dryRun) {
    console.log("\n  Would generate:");
    for (const c of candidates.slice(0, limit)) {
      console.log(`    G${c.lesson.grade}: ${c.lesson.title}  [${c.type}]`);
    }
    await prisma.$disconnect();
    return;
  }

  const batch = candidates.slice(0, limit);
  let generated = 0;
  let errors = 0;

  for (let i = 0; i < batch.length; i++) {
    const { lesson, body, type } = batch[i];
    console.log(`\n  [${i + 1}/${batch.length}] G${lesson.grade}: ${lesson.title}  [${type}]`);

    const result = await generateAILiteracy({
      lessonId: lesson.id,
      lessonTitle: lesson.title ?? "Untitled",
      lessonBody: body,
      grade: lesson.grade,
      type,
    });

    if (result.success === false) {
      errors++;
      console.log(`    ERROR: ${result.reason}`);
    } else {
      const { exercise } = result;
      const promptId = `${lesson.contentId}:ai_literacy:${type}:1`;

      await prisma.aILiteracyExercise.upsert({
        where: { promptId },
        create: {
          lessonId: lesson.id,
          promptId,
          title: exercise.title,
          type: exercise.type,
          scenario: exercise.scenario,
          studentPromptInstruction: exercise.studentPromptInstruction,
          rubric: exercise.rubric as any,
          gradedBy: "llm",
        },
        update: {
          title: exercise.title,
          scenario: exercise.scenario,
          studentPromptInstruction: exercise.studentPromptInstruction,
          rubric: exercise.rubric as any,
        },
      });

      generated++;
      console.log(`    OK — "${exercise.title}"`);
    }

    if (i < batch.length - 1) await sleep(GAP_MS);
  }

  console.log(`
  ─────────────────────────────────
  Results:
    Generated: ${generated}
    Errors:    ${errors}
  ─────────────────────────────────`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
