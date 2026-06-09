import { prisma } from "@/lib/db";

async function main() {
  for (const email of ["teacher1@liberialearn.dev", "teacher1@cha.edu.lr"]) {
    const t = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, schoolId: true, teacherOf: { select: { id: true, name: true, gradeLevel: true }, take: 5 } },
    });
    console.log(`TEACHER ${email}:`, JSON.stringify(t, null, 2));
    if (t?.teacherOf?.length) {
      for (const cls of t.teacherOf.slice(0, 2)) {
        const enr = await prisma.enrollment.findMany({
          where: { classId: cls.id },
          select: { Student: { select: { id: true, user: { select: { email: true, name: true } } } } },
          take: 3,
        });
        console.log(`  CLASS ${cls.name} students:`, JSON.stringify(enr.map(e => e.Student.user?.email), null, 0));
      }
    }
  }
  // student1@cha.edu.lr enrollments + guardians
  const s = await prisma.user.findUnique({
    where: { email: "student1@cha.edu.lr" },
    select: { id: true, schoolId: true, student: { select: { id: true, enrollments: { select: { classId: true, Class: { select: { name: true, teacherId: true } } } } } } },
  });
  console.log("STUDENT1@cha:", JSON.stringify(s, null, 2));
  if (s?.student) {
    const g = await prisma.studentGuardian.findMany({
      where: { studentId: s.student.id },
      select: { guardian: { select: { email: true, phone: true, smsOptIn: true } } },
    });
    console.log("GUARDIANS:", JSON.stringify(g, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
