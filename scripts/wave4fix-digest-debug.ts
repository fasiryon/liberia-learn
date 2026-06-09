import { prisma } from "@/lib/db";

async function main() {
  const g = await prisma.user.findUnique({
    where: { email: "guardian1@cha.family.lr" },
    select: {
      id: true, smsOptIn: true, preferredChannel: true, guardianSmsPreferences: true,
      guardianOf: { select: { studentId: true, student: { select: { userId: true, user: { select: { name: true } } } } } },
    },
  });
  console.log("GUARDIAN:", JSON.stringify(g, null, 2));
  if (!g) return;

  const studentIds = g.guardianOf.map((x) => x.studentId);       // Student.id values
  const userIds = g.guardianOf.map((x) => x.student.userId);     // User.id values
  const weekStart = new Date("2026-06-08T00:00:00Z");
  const weekEnd = new Date("2026-06-14T23:59:59Z");

  const byStudentId = await prisma.studentProgress.count({
    where: { studentId: { in: studentIds }, startedAt: { gte: weekStart, lte: weekEnd } },
  });
  const byUserId = await prisma.studentProgress.count({
    where: { studentId: { in: userIds }, startedAt: { gte: weekStart, lte: weekEnd } },
  });
  console.log("progress count using Student.id (digest's query):", byStudentId);
  console.log("progress count using User.id   (what's stored):  ", byUserId);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
