import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export type StudentReaderUser = { id: string; schoolId?: string | null };

/**
 * The learner's current enrollment authority: one bounded read of the student record, its
 * academic enrollment and own-school roster. Class roster membership is the authority;
 * grade/subject never grant access. Null when there is no valid own-school student record.
 * Never cache this result as authorization: callers read it per request and may key derived
 * presentation caches by `enrollmentScopeFingerprint`.
 */
export async function loadStudentEnrollmentScope(user: StudentReaderUser, classId?: string) {
  if (!user.schoolId) return null;
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, currentGrade: true, deletedAt: true, user: { select: { schoolId: true } },
      academicEnrollments: { select: { schoolId: true, status: true,
        academicYear: { select: { isActive: true, startDate: true, endDate: true } } } },
      enrollments: { where: { ...(classId ? { classId } : {}), Class: { schoolId: user.schoolId } },
        select: { Class: { select: { id: true, name: true, subject: true, gradeLevel: true, schoolId: true,
          Teacher: { select: { name: true, schoolId: true } }, School: { select: { name: true } } } } } } },
  });
  if (!student || student.deletedAt || student.user.schoolId !== user.schoolId) return null;
  const scope = { studentId: student.id, schoolId: user.schoolId, currentGrade: student.currentGrade ?? null };
  const now = new Date();
  // Legacy schools have only roster records. Once academic enrollment exists, stale years/statuses fail closed.
  if (student.academicEnrollments.length && !student.academicEnrollments.some((e) =>
    e.schoolId === user.schoolId && e.status === "ACTIVE" && e.academicYear.isActive &&
    e.academicYear.startDate <= now && e.academicYear.endDate >= now)) return { ...scope, classes: [] };
  return { ...scope, classes: student.enrollments.filter((e) => e.Class.schoolId === user.schoolId && (!classId || e.Class.id === classId))
    .map(({ Class: c }) => ({ classId: c.id, className: c.name, subject: String(c.subject),
      grade: c.gradeLevel, teacher: c.Teacher?.schoolId === user.schoolId ? c.Teacher.name : null, school: c.School.name })) };
}

/** Class roster membership is the authority; grade/subject never grant access. */
export async function loadStudentClasses(user: StudentReaderUser, classId?: string) {
  return (await loadStudentEnrollmentScope(user, classId))?.classes ?? [];
}

/**
 * Deterministic identity of a current enrollment scope: user, school, student and sorted
 * authorized class ids. Any enrollment, school or academic-status change yields a new value,
 * so a cache keyed by it can never be addressed after the scope it was built for ends.
 */
export function enrollmentScopeFingerprint(userId: string, scope: { schoolId: string; studentId: string; classes: Array<{ classId: string }> }) {
  const classIds = [...new Set(scope.classes.map((c) => c.classId))].sort();
  return createHash("sha256").update(JSON.stringify([userId, scope.schoolId, scope.studentId, classIds])).digest("hex").slice(0, 24);
}
