/**
 * Fix subject name mismatches in production DB (CurriculumContent.subject).
 *
 * Renames:
 *   ENGINEERING  → ENGINEERING_FOUNDATIONS
 *   CS           → COMPUTER_SCIENCE  (only if rows exist)
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/fix-subject-names.ts
 */

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { prisma } from "../lib/prisma";

async function main() {
  // ── Counts first ─────────────────────────────────────────────────────────
  const engCount = await prisma.curriculumContent.count({
    where: { subject: "ENGINEERING" },
  });
  const csCount = await prisma.curriculumContent.count({
    where: { subject: "CS" },
  });
  console.log(`Pre-fix counts — ENGINEERING: ${engCount}, CS: ${csCount}`);

  // ── 1. ENGINEERING → ENGINEERING_FOUNDATIONS ─────────────────────────────
  if (engCount > 0) {
    const r1 = await prisma.curriculumContent.updateMany({
      where: { subject: "ENGINEERING" },
      data: { subject: "ENGINEERING_FOUNDATIONS" },
    });
    console.log("Renamed ENGINEERING → ENGINEERING_FOUNDATIONS:", r1.count);
  } else {
    console.log("ENGINEERING → ENGINEERING_FOUNDATIONS: skipped (none found)");
  }

  // ── 2. CS → COMPUTER_SCIENCE ─────────────────────────────────────────────
  if (csCount > 0) {
    const r2 = await prisma.curriculumContent.updateMany({
      where: { subject: "CS" },
      data: { subject: "COMPUTER_SCIENCE" },
    });
    console.log("Renamed CS → COMPUTER_SCIENCE:", r2.count);
  } else {
    console.log("CS → COMPUTER_SCIENCE: skipped (none found)");
  }

  // ── Post-fix verification ─────────────────────────────────────────────────
  const remaining = await prisma.curriculumContent.groupBy({
    by: ["subject"],
    _count: { subject: true },
    orderBy: { subject: "asc" },
  });
  console.log("\nPost-fix subject distribution:");
  for (const row of remaining) {
    console.log(`  ${row.subject}: ${row._count.subject}`);
  }

  console.log("\nDone.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
