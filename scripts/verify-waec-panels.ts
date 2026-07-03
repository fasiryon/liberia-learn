/** Read-only: verify the teacher + national WAEC panel aggregations against prod. */
import { prisma } from "@/lib/db";
import { getTeacherWaecReadiness, getNationalWaecReadiness } from "@/lib/waec/aggregate";

async function main() {
  const nat = await getNationalWaecReadiness();
  console.log(`\n=== MOE NATIONAL PANEL (${nat.studentCount} G9+ students) ===`);
  for (const s of nat.subjects) {
    console.log(`  ${s.name.padEnd(28)} avg=${s.avgReadiness ?? "—"}  assessed=${s.assessedStudents}  atRisk=${s.atRisk}  onTrack=${s.onTrack}`);
  }
  console.log("  By county:", nat.byCounty.slice(0, 8).map((c) => `${c.county}:${c.avgReadiness ?? "—"}(${c.assessedStudents})`).join("  "));

  // Find a teacher whose class contains G9+ students that have mastery data.
  const profile = await prisma.studentMasteryProfile.findFirst({ where: { lastAssessedAt: { not: null } }, select: { studentId: true } });
  const cls = profile ? await prisma.class.findFirst({
    where: { enrollments: { some: { studentId: profile.studentId } }, teacherId: { not: null } },
    select: { teacherId: true, name: true, Teacher: { select: { email: true } } },
  }) : null;

  if (cls?.teacherId) {
    const t = await getTeacherWaecReadiness(cls.teacherId);
    console.log(`\n=== TEACHER PANEL — ${cls.Teacher?.email} (class ${cls.name}, ${t.studentCount} G9+ students) ===`);
    for (const s of t.subjects) {
      console.log(`  ${s.name.padEnd(28)} avg=${s.avgReadiness ?? "—"}  assessed=${s.assessedStudents}  atRisk=${s.atRisk}  onTrack=${s.onTrack}`);
    }
  } else {
    console.log("\nNo teacher-with-data class found for teacher panel demo.");
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
