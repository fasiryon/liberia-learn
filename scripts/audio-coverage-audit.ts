/**
 * NR-14 repository-side audio coverage audit.
 * Read-only: it never queues, updates, publishes, or deletes records.
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
function cleanEnv(key: string) {
  if (process.env[key]) process.env[key] = process.env[key]!.replace(/^['"]|['"]$/g, "");
}
cleanEnv("DATABASE_URL");

import { prisma } from "@/lib/db";
import { summarizeAudioCoverage, type AudioCoverageLesson } from "@/lib/audio/audioCoverage";

const SUBJECTS = [
  "MATH", "SCIENCE", "LITERACY", "ENGLISH", "SOCIAL_STUDIES", "CIVICS",
  "COMPUTER_SCIENCE", "ENGINEERING_FOUNDATIONS",
] as const;

async function main() {
  const lessons = await prisma.curriculumContent.findMany({
    where: { status: "APPROVED", contentType: "lesson" },
    select: {
      contentId: true,
      grade: true,
      subject: true,
      version: true,
      payload: true,
      audioAssets: {
        orderBy: { generatedAt: "desc" },
        select: { status: true, contentVersion: true, audioParts: true },
      },
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }],
  }) as AudioCoverageLesson[];

  const overall = summarizeAudioCoverage(lessons);
  const unresolved = overall.missing + overall.stale + overall.failed;
  console.log("=== NR-14 AUDIO COVERAGE AUDIT (READ-ONLY) ===");
  console.log(JSON.stringify({
    overall,
    missingRatePct: overall.eligible
      ? Number((unresolved / overall.eligible * 100).toFixed(2))
      : 0,
  }, null, 2));

  for (const grade of [...new Set(lessons.map((lesson) => lesson.grade))].sort((a, b) => a - b)) {
    for (const subject of SUBJECTS) {
      const row = lessons.filter((lesson) => lesson.grade === grade && lesson.subject === subject);
      if (row.length > 0) console.log(`G${grade} ${subject}: ${JSON.stringify(summarizeAudioCoverage(row))}`);
    }
  }

  console.log(
    overall.eligible > 0 && unresolved / overall.eligible >= 0.01
      ? "NR-14 GATE: OPEN (missing/stale/failed audio is at or above 1%)"
      : "NR-14 GATE: PASS (<1% eligible lessons missing/stale/failed audio)",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
