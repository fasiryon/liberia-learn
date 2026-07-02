/** Read-only: what StudentMasteryProfile data exists, by strand + student grade. */
import { prisma } from "@/lib/db";

async function main() {
  const assessed = await prisma.studentMasteryProfile.findMany({
    where: { lastAssessedAt: { not: null } },
    select: { studentId: true, subject: true, strandKey: true, currentScore: true },
  });
  console.log(`Assessed profiles: ${assessed.length}`);

  const byStrand: Record<string, number> = {};
  for (const a of assessed) byStrand[`${a.subject}:${a.strandKey}`] = (byStrand[`${a.subject}:${a.strandKey}`] ?? 0) + 1;
  console.log("\nBy subject:strand:");
  for (const [k, v] of Object.entries(byStrand).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(32)} ${v}`);

  const studentIds = Array.from(new Set(assessed.map((a) => a.studentId)));
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, currentGrade: true, user: { select: { email: true } } },
  });
  const gradeDist: Record<string, number> = {};
  for (const s of students) gradeDist[`G${s.currentGrade ?? "?"}`] = (gradeDist[`G${s.currentGrade ?? "?"}`] ?? 0) + 1;
  console.log("\nDistinct students with assessed mastery:", students.length);
  console.log("Their grade distribution:", JSON.stringify(gradeDist));
  console.log("G9+ among them:", students.filter((s) => (s.currentGrade ?? 0) >= 9).map((s) => `${s.user?.email}(G${s.currentGrade})`).join(", ") || "NONE");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
