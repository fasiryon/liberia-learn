/**
 * Fix subject name mismatches in production DB (CurriculumContent.subject).
 *
 * Renames:
 *   ENGINEERING  â†’ ENGINEERING_FOUNDATIONS
 *   CS           â†’ COMPUTER_SCIENCE  (only if rows exist)
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/fix-subject-names.ts
 */

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { prisma } from "../lib/prisma";
import { createConservativeCurriculumMaintenanceClient } from "../lib/curriculum/mutations/maintenanceClient";
const governedCurriculum = createConservativeCurriculumMaintenanceClient("fix-subject-names");

async function main() {
  // â”€â”€ Counts first â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const engCount = await prisma.curriculumContent.count({
    where: { subject: "ENGINEERING" },
  });
  const csCount = await prisma.curriculumContent.count({
    where: { subject: "CS" },
  });
  console.log(`Pre-fix counts â€” ENGINEERING: ${engCount}, CS: ${csCount}`);

  // â”€â”€ 1. ENGINEERING â†’ ENGINEERING_FOUNDATIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (engCount > 0) {
    const r1 = await governedCurriculum.updateMany({
      where: { subject: "ENGINEERING" },
      data: { subject: "ENGINEERING_FOUNDATIONS" },
    });
    console.log("Renamed ENGINEERING â†’ ENGINEERING_FOUNDATIONS:", r1.count);
  } else {
    console.log("ENGINEERING â†’ ENGINEERING_FOUNDATIONS: skipped (none found)");
  }

  // â”€â”€ 2. CS â†’ COMPUTER_SCIENCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (csCount > 0) {
    const r2 = await governedCurriculum.updateMany({
      where: { subject: "CS" },
      data: { subject: "COMPUTER_SCIENCE" },
    });
    console.log("Renamed CS â†’ COMPUTER_SCIENCE:", r2.count);
  } else {
    console.log("CS â†’ COMPUTER_SCIENCE: skipped (none found)");
  }

  // â”€â”€ Post-fix verification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
