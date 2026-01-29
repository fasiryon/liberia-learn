const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const studentId = process.env.DEMO_STUDENT_ID || process.argv[2];
  if (!studentId) throw new Error("Need studentId");

  const last = await prisma.grade.findFirst({
    where: { studentId },
    orderBy: { computedAt: "desc" },
    select: { studentId: true, classId: true },
  });

  if (!last) throw new Error("No grade found for student");

  const percent = Number(process.argv[3] || 88);
  const letter = String(process.argv[4] || "B");

  const g = await prisma.grade.create({
    data: { studentId: last.studentId, classId: last.classId, percent, letter },
    select: { id: true, percent: true },
  });

  console.log("NEW_GRADE_ID=" + g.id);
  console.log(g);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
