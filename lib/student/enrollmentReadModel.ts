import { prisma } from "@/lib/db";

export type StudentReaderUser = { id: string; schoolId?: string | null };

/** Class roster membership is the authority; grade/subject never grant access. */
export async function loadStudentClasses(user: StudentReaderUser, classId?: string) {
  if (!user.schoolId) return [];
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, deletedAt: true, user: { select: { schoolId: true } },
      academicEnrollments: { select: { schoolId: true, status: true,
        academicYear: { select: { isActive: true, startDate: true, endDate: true } } } },
      enrollments: { where: { ...(classId ? { classId } : {}), Class: { schoolId: user.schoolId } },
        select: { Class: { select: { id: true, name: true, subject: true, gradeLevel: true, schoolId: true,
          Teacher: { select: { name: true, schoolId: true } }, School: { select: { name: true } } } } } } },
  });
  if (!student || student.deletedAt || student.user.schoolId !== user.schoolId) return [];
  const now = new Date();
  // Legacy schools have only roster records. Once academic enrollment exists, stale years/statuses fail closed.
  if (student.academicEnrollments.length && !student.academicEnrollments.some((e) =>
    e.schoolId === user.schoolId && e.status === "ACTIVE" && e.academicYear.isActive &&
    e.academicYear.startDate <= now && e.academicYear.endDate >= now)) return [];
  return student.enrollments.filter((e) => e.Class.schoolId === user.schoolId && (!classId || e.Class.id === classId))
    .map(({ Class: c }) => ({ classId: c.id, className: c.name, subject: String(c.subject),
      grade: c.gradeLevel, teacher: c.Teacher?.schoolId === user.schoolId ? c.Teacher.name : null, school: c.School.name }));
}
