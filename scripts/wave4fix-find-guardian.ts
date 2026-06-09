import { prisma } from "@/lib/db";

async function main() {
  const student = await prisma.user.findUnique({
    where: { email: "student1@liberialearn.dev" },
    select: { id: true, name: true, schoolId: true, student: { select: { id: true, enrollments: { select: { classId: true } } } } },
  });
  console.log("STUDENT1:", JSON.stringify(student, null, 2));
  if (!student?.student) return;

  const links = await prisma.studentGuardian.findMany({
    where: { studentId: student.student.id },
    select: { guardian: { select: { id: true, email: true, name: true, phone: true, smsOptIn: true } } },
  });
  console.log("GUARDIANS:", JSON.stringify(links, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
