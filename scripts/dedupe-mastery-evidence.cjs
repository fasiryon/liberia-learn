const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.masteryEvidence.findMany({
    select: { id: true, gradeId: true, recordedAt: true },
    orderBy: { recordedAt: "desc" },
  });

  const seen = new Set();
  const toDelete = [];

  for (const r of rows) {
    if (!r.gradeId) continue;
    if (seen.has(r.gradeId)) toDelete.push(r.id);
    else seen.add(r.gradeId);
  }

  console.log("Total rows:", rows.length);
  console.log("Rows with gradeId:", rows.filter(r => r.gradeId).length);
  console.log("Duplicate rows to delete:", toDelete.length);
  
  if (!toDelete.length) {
    console.log("No duplicates found. Nothing to delete.");
    await prisma.$disconnect();
    return;
  }

  const res = await prisma.masteryEvidence.deleteMany({
    where: { id: { in: toDelete } }
  });

  console.log("Deleted:", res.count);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
