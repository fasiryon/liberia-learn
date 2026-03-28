import { prisma } from "@/lib/db";

export async function getTeacherScope(teacherId: string, schoolId: string) {
  const classes = await prisma.class.findMany({
    where: { teacherId, schoolId },
    select: {
      id: true,
      name: true,
      enrollments: {
        select: {
          studentId: true,
          Student: {
            select: {
              id: true,
              currentGrade: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const studentMap = new Map<
    string,
    { id: string; name: string | null; currentGrade: number | null; className: string | null }
  >();

  for (const cls of classes) {
    for (const enrollment of cls.enrollments) {
      studentMap.set(enrollment.studentId, {
        id: enrollment.Student.id,
        name: enrollment.Student.user?.name ?? null,
        currentGrade: enrollment.Student.currentGrade ?? null,
        className: cls.name,
      });
    }
  }

  return {
    classIds: classes.map((entry) => entry.id),
    studentIds: Array.from(studentMap.keys()),
    students: studentMap,
  };
}
