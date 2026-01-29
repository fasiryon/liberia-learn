const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.masteryEvidence.findMany({
    where: { gradeId: { notIn: [null] } },
    select: { id: true, gradeId: true, recordedAt: true },
    orderBy: { recordedAt: "desc" }, // newest first
  });

  const counts = new Map();
  for (const r of rows) {
    counts.set(r.gradeId, (counts.get(r.gradeId) || 0) + 1);
  }

  const dups = [...counts.entries()].filter(([_, c]) => c > 1);
  console.log("Total evidence rows with gradeId:", rows.length);
  console.log("Duplicate gradeIds:", dups.length);

  // Show up to 20 duplicates
  for (const [gradeId, c] of dups.slice(0, 20)) {
    console.log(`- ${gradeId}: ${c}`);
  }

  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
