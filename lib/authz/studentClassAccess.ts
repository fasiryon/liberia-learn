/**
 * A learner reached only through class authority (AT-GRADE-01 batch 3): an ADMIN of the learner's school (school-scoped
 * oversight), or a TEACHER for whom lib/authz/classAuthority grants `fn` (with `subject`) on a class the learner is
 * enrolled in, in the teacher's own school. Returns null otherwise, so callers answer with their non-disclosing 404.
 * No parallel teacher-scope rule: TeacherAssignment and Class.teacherId are decided by the service only.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authorizeClassAccess, type ClassFunction } from "@/lib/authz/classAuthority";

type Actor = Readonly<{ id: string; role: string; schoolId?: string | null }>;

export async function findStudentThroughClassAuthority(
  actor: Actor,
  studentId: string,
  request: Readonly<{ fn: ClassFunction; subject?: string; studentWhere?: Prisma.StudentWhereInput }>,
): Promise<{ id: string; userId: string } | null> {
  if (!actor.schoolId) return null;
  const student = await prisma.student.findFirst({
    where: { id: studentId, user: { schoolId: actor.schoolId }, ...(request.studentWhere ?? {}) },
    select: { id: true, userId: true, enrollments: { select: { classId: true, Class: { select: { schoolId: true } } } } },
  });
  if (!student) return null;
  if (actor.role === "ADMIN") return { id: student.id, userId: student.userId };
  if (actor.role !== "TEACHER") return null;
  const classIds = Array.from(new Set(student.enrollments.filter((e) => e.Class.schoolId === actor.schoolId).map((e) => e.classId)));
  for (const classId of classIds) {
    const decision = await authorizeClassAccess({ id: actor.id, role: actor.role as "TEACHER", schoolId: actor.schoolId }, { classId, subject: request.subject, fn: request.fn });
    if (decision.allowed) return { id: student.id, userId: student.userId };
  }
  return null;
}
