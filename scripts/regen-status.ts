/**
 * scripts/regen-status.ts
 *
 * Read-only status check for curriculum regeneration jobs and lesson content.
 * No DB writes.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/regen-status.ts
 */

// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

function pad(s: string | number, width: number) {
  return String(s).padEnd(width);
}

function padLeft(s: string | number, width: number) {
  return String(s).padStart(width);
}

async function main() {
  const [jobCounts, contentApproved, contentNeedsReview, recentRuns] = await Promise.all([
    prisma.curriculumRegenerationJob.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.curriculumContent.count({
      where: { status: "APPROVED", contentType: "lesson" },
    }),
    prisma.curriculumContent.count({
      where: { status: "NEEDS_REVIEW", contentType: "lesson" },
    }),
    prisma.curriculumRegenerationRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        status: true,
        totalPlanned: true,
        totalProcessed: true,
        totalApproved: true,
        totalFailed: true,
        createdAt: true,
      },
    }),
  ]);

  const statusOrder = ["pending", "processing", "approved", "failed", "skipped"];
  const counts: Record<string, number> = {};
  for (const row of jobCounts) counts[row.status] = row._count._all;

  const separator = "├─────────────────────┼───────┤";
  const top        = "┌─────────────────────┬───────┐";
  const bottom     = "└─────────────────────┴───────┘";

  console.log("\nJob Status (CurriculumRegenerationJob):");
  console.log(top);
  console.log(`│ ${pad("Status", 19)} │ ${pad("Count", 5)} │`);
  console.log(separator);
  for (const s of statusOrder) {
    const n = counts[s] ?? 0;
    if (n > 0 || s === "pending" || s === "failed") {
      console.log(`│ ${pad(s.toUpperCase(), 19)} │ ${padLeft(n.toLocaleString(), 5)} │`);
    }
  }
  const otherStatuses = Object.keys(counts).filter((s) => !statusOrder.includes(s));
  for (const s of otherStatuses) {
    console.log(`│ ${pad(s.toUpperCase(), 19)} │ ${padLeft((counts[s] ?? 0).toLocaleString(), 5)} │`);
  }
  console.log(bottom);

  console.log("\nLesson Content Status:");
  console.log(top);
  console.log(`│ ${pad("Status", 19)} │ ${pad("Count", 5)} │`);
  console.log(separator);
  console.log(`│ ${pad("APPROVED", 19)} │ ${padLeft(contentApproved.toLocaleString(), 5)} │`);
  console.log(`│ ${pad("NEEDS_REVIEW", 19)} │ ${padLeft(contentNeedsReview.toLocaleString(), 5)} │`);
  console.log(bottom);

  if (recentRuns.length > 0) {
    console.log("\nRecent Runs (latest 5):");
    for (const run of recentRuns) {
      console.log(
        `  ${run.id.slice(0, 20)}  ${pad(run.status.toUpperCase(), 22)}  planned:${run.totalPlanned}  processed:${run.totalProcessed}  approved:${run.totalApproved}  failed:${run.totalFailed}  created:${run.createdAt.toISOString().slice(0, 16)}`
      );
    }
  }

  console.log("");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
