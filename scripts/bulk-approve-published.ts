// Approves NEEDS_REVIEW lessons that meet quality thresholds.
//
// IMPORTANT (NR-11, 2026-08-02 -> risk-triage 2026-08-03): this used to be a
// pure automated content-quality gate with no human involvement at all. It
// now routes its highest-risk passing candidates to a real human/MOE
// reviewer instead of auto-approving silently - see
// docs/superpowers/specs/2026-08-03-curriculum-risk-triage-design.md and
// lib/curriculum/riskTriage.ts. Everything that still auto-approves is now
// audit-logged and risk-stamped for the first time (unlike the pre-triage
// behavior, where 712 of 1,089 APPROVED/published rows carried no approver
// identity at all).
//
// Quality gates (a lesson must pass ALL to be a triage candidate):
//   1. word count >= grade-band minimum:
//        G1-G3: 400 words  |  G4-G6: 600 words  |  G7-G12: 800 words
//   2. Has substantive content (text length >= 200 chars - filters empty shells)
//   3. Title is not a placeholder ("untitled", "test", "draft", etc.)
//
// Usage:
//   # Dry run (shows what would happen, changes nothing):
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts --dry-run
//
//   # Priority grades first (G5 and G7 have the most critical deserts):
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts --grades=5,7
//
//   # Run against all passing lessons:
//   npx dotenv -e .env.production -- npx tsx scripts/bulk-approve-published.ts

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { prisma } from "@/lib/db";
import {
  computeRiskScore,
  isFirstOfKindCell,
  isWorthFlagging,
  getFlaggedCountInWindow,
  triageAndApprove,
  WEEKLY_REVIEW_BUDGET,
} from "@/lib/curriculum/riskTriage";

const PLACEHOLDER_TITLES = [
  "untitled",
  "test",
  "draft",
  "placeholder",
  "todo",
  "tbd",
  "lesson title",
];

// Grade-band word minimums - these plain-text lessons (~700-900 words) use a
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
  if (dryRun) console.log("DRY RUN - no changes will be made");
  if (gradeFilter) console.log(`Grade filter: G${gradeFilter.join(", G")}`);
  console.log();

  let approved = 0;
  let flagged = 0;
  let rejected = 0;
  let simulatedFlaggedCount: number | undefined;
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
        `[EMPTY]  G${lesson.grade} ${lesson.subject} - "${lesson.title ?? lesson.contentId}" - no body content`
      );
      continue;
    }
    if (!wordGate) {
      rejected++;
      rejectReasons.push(
        `[THIN]   G${lesson.grade} ${lesson.subject} - "${lesson.title ?? lesson.contentId}" - ${words} words (min ${minWords})`
      );
      continue;
    }
    if (!titleGate) {
      rejected++;
      rejectReasons.push(
        `[TITLE]  G${lesson.grade} ${lesson.subject} - placeholder title: "${lesson.title}"`
      );
      continue;
    }

    if (dryRun) {
      // Read-only preview: same scoring/budget logic triageAndApprove uses,
      // but no writes - mirrors what a real run would decide.
      const isFirstOfKind = await isFirstOfKindCell(lesson.grade, lesson.subject);
      const { score, reasons } = computeRiskScore({
        grade: lesson.grade,
        subject: lesson.subject,
        isFirstOfKind,
        wordCount: words,
        minWordCount: minWords,
      });
      const worthFlagging = isWorthFlagging(score);
      let wouldFlag = false;
      if (worthFlagging) {
        try {
          simulatedFlaggedCount ??= await getFlaggedCountInWindow();
          wouldFlag = simulatedFlaggedCount < WEEKLY_REVIEW_BUDGET;
        } catch {
          // Mirror the write path's safety policy: a failed budget lookup
          // must preview as held for review, never as silently approved.
          wouldFlag = true;
        }
      }
      if (wouldFlag) {
        flagged++;
        if (simulatedFlaggedCount !== undefined) simulatedFlaggedCount++;
        process.stdout.write(
          `[WOULD FLAG] G${lesson.grade} ${lesson.subject} - ${lesson.title ?? lesson.contentId} (score ${score}: ${reasons.join(", ")})\n`
        );
      } else {
        approved++;
        process.stdout.write(
          `[WOULD APPROVE] G${lesson.grade} ${lesson.subject} - ${lesson.title ?? lesson.contentId} (${words}w, score ${score})\n`
        );
      }
      continue;
    }

    const result = await triageAndApprove(
      {
        contentId: lesson.contentId,
        grade: lesson.grade,
        subject: lesson.subject,
        payload: (lesson.payload as Record<string, unknown>) ?? {},
        approvalMetadata: {
          approvalStatus: "APPROVED",
          approvedAt: new Date().toISOString(),
          bulkApproved: true,
        },
        wordCount: words,
        minWordCount: minWords,
      },
      "system:bulk-approve-published",
      "published"
    );

    if (result.action === "flagged") {
      flagged++;
      if (flagged <= 20) {
        process.stdout.write(
          `[FLAGGED FOR REVIEW] G${lesson.grade} ${lesson.subject} - ${lesson.title ?? lesson.contentId} (score ${result.riskScore}: ${result.riskReasons.join(", ")})\n`
        );
      }
    } else {
      approved++;
      if (approved <= 20 || approved % 50 === 0) {
        process.stdout.write(
          `[APPROVED] G${lesson.grade} ${lesson.subject} - ${lesson.title ?? lesson.contentId} (${words}w, score ${result.riskScore})\n`
        );
      } else if (approved === 21) {
        process.stdout.write("... (showing every 50th after first 20)\n");
      }
    }
  }

  console.log("\n========= SUMMARY =========");
  console.log(`${dryRun ? "Would approve" : "Approved"}: ${approved}`);
  console.log(`${dryRun ? "Would flag for review" : "Flagged for review"}: ${flagged}`);
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
