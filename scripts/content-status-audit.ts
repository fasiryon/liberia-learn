// Run with: npx dotenv -e .env.production -- npx tsx scripts/content-status-audit.ts
// Requires production DATABASE_URL or DIRECT_URL.

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SUBJECTS = [
  "MATH",
  "SCIENCE",
  "LITERACY",
  "ENGLISH",
  "SOCIAL_STUDIES",
  "CIVICS",
  "COMPUTER_SCIENCE",
  "ENGINEERING_FOUNDATIONS",
];
const STATUSES = ["APPROVED", "published", "PUBLISHED", "PENDING", "NEEDS_REVIEW", "DRAFT"];

function extractWords(payload: unknown): number {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return 0;
  const p = payload as Record<string, unknown>;
  // Field priority matches spot-check-needs-review and spot-check-approved patterns
  const text =
    (typeof p.lessonContent === "string" ? p.lessonContent : "") ||
    (typeof p.content === "string" ? p.content : "") ||
    (typeof p.lessonBody === "string" ? p.lessonBody : "") ||
    (typeof p.body_block === "string" ? p.body_block : "") ||
    (typeof p.body_standard === "string" ? p.body_standard : "") ||
    (typeof p.body === "string" ? p.body : "");
  return text
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getDepthWordCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Record<string, unknown>;
  const gen = p.generationMetadata;
  if (gen && typeof gen === "object" && !Array.isArray(gen)) {
    const g = gen as Record<string, unknown>;
    if (typeof g.depthWordCount === "number") return g.depthWordCount;
  }
  return null;
}

async function main() {
  console.log("\n=== CONTENT STATUS TOTALS ===\n");
  for (const status of STATUSES) {
    const count = await prisma.curriculumContent.count({ where: { status } });
    console.log(`${status.padEnd(16)}: ${count}`);
  }

  console.log("\n=== REVIEW BACKLOG (NEEDS_REVIEW status) by Grade × Subject ===");
  console.log("Grade | Subject              | Count");
  console.log("------|----------------------|------");

  let totalNeedsReview = 0;
  for (const grade of GRADES) {
    for (const subject of SUBJECTS) {
      const count = await prisma.curriculumContent.count({
        where: { grade, subject, status: "NEEDS_REVIEW" },
      });
      if (count > 0) {
        console.log(`G${String(grade).padEnd(4)}| ${subject.padEnd(20)} | ${count}`);
        totalNeedsReview += count;
      }
    }
  }
  console.log(`\nTotal NEEDS_REVIEW: ${totalNeedsReview}`);

  console.log("\n=== QUALITY CHECK ON NEEDS_REVIEW LESSONS ===");
  const published = await prisma.curriculumContent.findMany({
    where: { status: "NEEDS_REVIEW", contentType: "lesson" },
    select: { contentId: true, grade: true, subject: true, title: true, payload: true },
  });

  const MIN_WORDS_BY_GRADE: Record<number, number> = {
    1: 1200, 2: 1200, 3: 1200,
    4: 1200, 5: 1200, 6: 1200,
    7: 1200, 8: 1200, 9: 1200,
    10: 1200, 11: 1200, 12: 1200,
  };

  let ready = 0;
  let thin = 0;
  const thinLessons: string[] = [];

  for (const lesson of published) {
    const depthCount = getDepthWordCount(lesson.payload);
    const words = depthCount ?? extractWords(lesson.payload);
    const min = MIN_WORDS_BY_GRADE[lesson.grade] ?? 1200;
    if (words >= min) {
      ready++;
    } else {
      thin++;
      thinLessons.push(`G${lesson.grade} ${lesson.subject} — "${lesson.title ?? lesson.contentId}" (${words} words)`);
    }
  }

  console.log(`Total NEEDS_REVIEW lessons: ${published.length}`);
  console.log(`≥1200 words (ready to approve): ${ready}`);
  console.log(`<1200 words (needs regen):      ${thin}`);

  if (thinLessons.length > 0) {
    console.log("\nThin lessons (first 20):");
    thinLessons.slice(0, 20).forEach((r) => console.log(" ", r));
    if (thinLessons.length > 20) {
      console.log(`  ... and ${thinLessons.length - 20} more`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
