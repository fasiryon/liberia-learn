/**
 * scripts/moe-alignment-backfill-check.ts
 *
 * Read-only. Confirms the real backfill candidate count under the fixed
 * status filter (APPROVED/published/approved) and breaks down standards
 * coverage by subject so we know which subjects can even produce a match.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/moe-alignment-backfill-check.ts
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient, Prisma } from "@prisma/client";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

const STATUS_FILTER = ["APPROVED", "published", "approved"];

async function main() {
  const [byStatus, backfillCandidates, totalInScope, standardsBySubject] = await Promise.all([
    prisma.curriculumContent.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.curriculumContent.count({
      where: { status: { in: STATUS_FILTER }, moeAlignments: { equals: Prisma.DbNull } },
    }),
    prisma.curriculumContent.count({
      where: { status: { in: STATUS_FILTER } },
    }),
    prisma.standard.groupBy({
      by: ["subject", "band"],
      _count: { _all: true },
      orderBy: [{ subject: "asc" }, { band: "asc" }],
    }),
  ]);

  console.log("\nCurriculumContent by status:");
  for (const row of byStatus) {
    console.log(`  ${row.status.padEnd(20)} ${row._count._all}`);
  }

  console.log(`\nIn-scope content (status in [${STATUS_FILTER.join(", ")}]): ${totalInScope}`);
  console.log(`Backfill candidates (in-scope AND moeAlignments IS NULL): ${backfillCandidates}`);

  console.log("\nStandard coverage by subject+band (what alignment CAN match against):");
  const subjectsWithStandards = new Set<string>();
  for (const row of standardsBySubject) {
    console.log(`  ${row.subject.padEnd(20)} ${row.band.padEnd(10)} ${row._count._all}`);
    subjectsWithStandards.add(row.subject);
  }
  console.log(`\nSubjects with at least one standard: ${[...subjectsWithStandards].join(", ")}`);

  // Distinct subjects present among the actual backfill candidates
  const candidateContent = await prisma.curriculumContent.findMany({
    where: { status: { in: STATUS_FILTER }, moeAlignments: { equals: Prisma.DbNull } },
    select: { subject: true },
  });
  const candidateSubjectCounts: Record<string, number> = {};
  for (const c of candidateContent) {
    candidateSubjectCounts[c.subject] = (candidateSubjectCounts[c.subject] ?? 0) + 1;
  }
  console.log("\nBackfill candidates by subject:");
  for (const [subj, n] of Object.entries(candidateSubjectCounts).sort((a, b) => b[1] - a[1])) {
    const hasStandards = subjectsWithStandards.has(subj.toUpperCase()) || subjectsWithStandards.has(subj);
    console.log(`  ${subj.padEnd(20)} ${String(n).padStart(6)}  ${hasStandards ? "" : "<- NO STANDARDS EXIST FOR THIS SUBJECT"}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
