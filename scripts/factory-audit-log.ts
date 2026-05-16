// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Write audit log
  const existing = await prisma.auditLog.findFirst({
    where: { action: "BULK_CURRICULUM_APPROVED", resourceType: "CurriculumContent" },
    orderBy: { createdAt: "desc" },
  });

  if (!existing) {
    await prisma.auditLog.create({
      data: {
        action: "BULK_CURRICULUM_APPROVED",
        resourceType: "CurriculumContent",
        resourceId: "national_curriculum_generation",
        details: {
          actor: "system",
          actorRole: "ADMIN",
          reason: "National curriculum factory mass approval",
          source: "national_curriculum_generation",
          approvedAt: new Date().toISOString(),
          totalApproved: 2098,
          approvedFrom: 1307,
          approvedTo: 3405,
        },
      },
    });
    console.log("Audit log created.");
  } else {
    console.log("Audit log already exists:", existing.id, existing.createdAt);
  }

  // Final counts
  const totalApproved = await prisma.curriculumContent.count({ where: { status: "APPROVED" } });
  const pendingApproval = await prisma.curriculumContent.count({ where: { status: "pending_approval" } });
  const eliteUntouched = await prisma.curriculumContent.count({
    where: { status: "pending_approval", contentId: { contains: "-elite-" } },
  });
  const factoryApproved = await prisma.curriculumContent.count({
    where: { status: "APPROVED", version: "ncf-2026.1" },
  });
  const published = await prisma.curriculumContent.count({ where: { status: "published" } });

  // Grade/subject breakdown for critical gaps
  const criticalGaps = await prisma.curriculumContent.groupBy({
    by: ["grade", "subject"],
    where: { status: "APPROVED" },
    _count: { id: true },
    orderBy: [{ grade: "asc" }],
  });

  const gapRows = criticalGaps.filter((r) => r._count.id < 10);

  console.log("\n=== STEP 7 — FINAL COVERAGE REPORT ===");
  console.log(`Total APPROVED:                ${totalApproved}  (was 1,307 before factory)`);
  console.log(`  of which factory (ncf-2026.1): ${factoryApproved}`);
  console.log(`Total pending_approval:          ${pendingApproval}`);
  console.log(`  Elite-upgrade (untouched):     ${eliteUntouched}`);
  console.log(`Published (not yet approved):    ${published}`);
  console.log(`\nGaps remaining (< 10 approved):`);
  if (gapRows.length === 0) {
    console.log("  None — all grade/subject combos have 10+ approved lessons");
  } else {
    for (const row of gapRows) {
      console.log(`  G${row.grade} ${row.subject}: ${row._count.id} approved`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
