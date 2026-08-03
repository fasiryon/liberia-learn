// Approves NEEDS_REVIEW lessons that meet quality thresholds.
//
// IMPORTANT (NR-11, 2026-08-02): this is an automated content-quality gate,
// not a substitute for human/MOE curriculum review. It checks word count,
// content length, and placeholder titles only — it has no way to judge
// pedagogical accuracy, cultural appropriateness, or curriculum alignment.
// Rows it approves carry payload.bulkApproved=true and no approver identity
// (unlike a real human approval via /api/admin/curriculum/approve, which
// records approvedByUserId and is written to AuditLog). As of 2026-08-01,
// roughly 65% of all APPROVED/published content in production (712 of 1,089
// rows) was approved this way, with zero human review and zero audit trail.
// Do not treat "APPROVED"/"published" status as evidence of MOE sign-off.
//
// Quality gates (a lesson must pass ALL to be approved):
//   1. word count >= grade-band minimum:
//        G1-G3: 400 words  |  G4-G6: 600 words  |  G7-G12: 800 words
//   2. Has substantive content (text length >= 200 chars — filters empty shells)
//   3. Title is not a placeholder ("untitled", "test", "draft", etc.)
//
// Sets status → "published" and payload.approvalStatus → "APPROVED" to match
// the approve route in /api/admin/curriculum/approve.
//
// Usage:
//   # Dry run (shows what would be approved, changes nothing):
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts --dry-run
//
//   # Priority grades first (G5 and G7 have the most critical deserts):
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts --grades=5,7
//
//   # Approve all passing lessons:
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLACEHOLDER_TITLES = [
  "untitled",
  "test",
  "draft",
  "placeholder",
  "todo",
  "tbd",
  "lesson title",
];

// Grade-band word minimums — these plain-text lessons (~700-900 words) use a
// different format than the block/standard lessons (which target 1200+).
const MIN_WORDS_BY_GRADE: Record<number, number> = {
  1: 400, 2: 400, 3: 400,
  4: 600, 5: 600, 6: 600,
  7: 800, 8: 800, 9: 800,
  10: 800, 11: 800, 12: 800,
};

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const p = payload as Record<string, unknown>;
  return (
    (typeof p.lessonContent === "string" ? p.lessonContent : "") ||
    (typeof p.content === "string" ? p.content : "") ||
    (typeof p.lessonBody === "string" ? p.lessonBody : "") ||
    (typeof p.body_block === "string" ? p.body_block : "") ||
    (typeof p.body_standard === "string" ? p.body_standard : "") ||
    (typeof p.body === "string" ? p.body : "")
  );
}

function wordCount(text: string): number {
  return text.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function getDepthWordCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const gen = p.generationMetadata;
  if (!gen || typeof gen !== "object" || Array.isArray(gen)) return null;
  const g = gen as Record<string, unknown>;
  return typeof g.depthWordCount === "number" ? g.depthWordCount : null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const gradesArg = args.find((a) => a.startsWith("--grades="));
  const gradeFilter = gradesArg
    ? gradesArg.replace("--grades=", "").split(",").map(Number).filter((n) => !isNaN(n))
    : null;

  const candidates = await prisma.curriculumContent.findMany({
    where: {
      status: "NEEDS_REVIEW",
      contentType: "lesson",
      ...(gradeFilter ? { grade: { in: gradeFilter } } : {}),
    },
    select: {
      id: true,
      contentId: true,
      grade: true,
      subject: true,
      title: true,
      payload: true,
    },
  });

  console.log(`\nFound ${candidates.length} NEEDS_REVIEW lessons to evaluate`);
  if (dryRun) console.log("DRY RUN — no changes will be made");
  if (gradeFilter) console.log(`Grade filter: G${gradeFilter.join(", G")}`);
  console.log();

  let approved = 0;
  let rejected = 0;
  const rejectReasons: string[] = [];

  for (const lesson of candidates) {
    const text = extractText(lesson.payload);
    const depthWords = getDepthWordCount(lesson.payload);
    const words = depthWords ?? wordCount(text);
    const minWords = MIN_WORDS_BY_GRADE[lesson.grade] ?? 400;
    const titleLower = (lesson.title ?? "").toLowerCase();

    const wordGate = words >= minWords;
    const contentGate = text.length >= 200;
    const titleGate = !PLACEHOLDER_TITLES.some((p) => titleLower.includes(p));

    if (!contentGate) {
      rejected++;
      rejectReasons.push(
        `[EMPTY]  G${lesson.grade} ${lesson.subject} — "${lesson.title ?? lesson.contentId}" — no body content`
      );
      continue;
    }
    if (!wordGate) {
      rejected++;
      rejectReasons.push(
        `[THIN]   G${lesson.grade} ${lesson.subject} — "${lesson.title ?? lesson.contentId}" — ${words} words (min ${minWords})`
      );
      continue;
    }
    if (!titleGate) {
      rejected++;
      rejectReasons.push(
        `[TITLE]  G${lesson.grade} ${lesson.subject} — placeholder title: "${lesson.title}"`
      );
      continue;
    }

    if (!dryRun) {
      const existingPayload = (lesson.payload as Record<string, unknown>) ?? {};
      await prisma.curriculumContent.update({
        where: { contentId: lesson.contentId },
        data: {
          status: "published",
          payload: {
            ...existingPayload,
            approvalStatus: "APPROVED",
            approvedAt: new Date().toISOString(),
            bulkApproved: true,
          },
        },
      });
    }

    approved++;
    if (approved <= 20 || approved % 50 === 0) {
      const action = dryRun ? "WOULD APPROVE" : "APPROVED";
      process.stdout.write(
        `[${action}] G${lesson.grade} ${lesson.subject} — ${lesson.title ?? lesson.contentId} (${words}w)\n`
      );
    } else if (approved === 21) {
      process.stdout.write("... (showing every 50th after first 20)\n");
    }
  }

  console.log("\n========= SUMMARY =========");
  console.log(`${dryRun ? "Would approve" : "Approved"}: ${approved}`);
  console.log(`Skipped (below quality gate): ${rejected}`);

  if (rejectReasons.length > 0) {
    console.log("\nSkipped lessons:");
    rejectReasons.slice(0, 30).forEach((r) => console.log(" ", r));
    if (rejectReasons.length > 30) {
      console.log(`  ... and ${rejectReasons.length - 30} more`);
    }
  }

  if (!dryRun && approved > 0) {
    console.log(
      "\nNote: Coverage cache will refresh automatically on next request (30-min TTL)."
    );
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
