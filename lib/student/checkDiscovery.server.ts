import { prisma } from "@/lib/db";
import { isExamSystemEnabled } from "@/lib/serverFlags";

/** Mirrors exam start's school, grade, roster and academic-year gates; never reads questions/readiness. */
export async function loadCheckDiscovery(student: { id: string; currentGrade: number | null }, schoolId: string, classIds: string[]) {
  if (!isExamSystemEnabled()) return { availability: "unavailable" as const, reason: "Checks are not available", total: 0, items: [] };
  if (!student.currentGrade) return { availability: "empty" as const, total: 0, items: [] };
  const academicEnrollments = await prisma.academicEnrollment.findMany({
    where: { studentId: student.id, schoolId }, select: { academicYearId: true },
  });
  const yearIds = academicEnrollments.map((row) => row.academicYearId);
  const exams = await prisma.exam.findMany({
    where: { schoolId, grade: student.currentGrade, status: "PUBLISHED", deletedAt: null,
      AND: [{ OR: [{ classId: null }, { classId: { in: classIds }, class: { schoolId } }] },
        { OR: [{ academicYearId: null }, { academicYearId: { in: yearIds } }] }] },
    select: { id: true, title: true, subject: true, status: true, schoolId: true, grade: true, classId: true, academicYearId: true, deletedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100,
  });
  const allowed = exams.filter((exam) => exam.schoolId === schoolId && exam.grade === student.currentGrade && exam.status === "PUBLISHED" && !exam.deletedAt && (!exam.classId || classIds.includes(exam.classId)) && (!exam.academicYearId || yearIds.includes(exam.academicYearId))).slice(0, 100);
  const passes = allowed.length ? await prisma.examAttempt.findMany({ where: { studentId: student.id, examId: { in: allowed.map((exam) => exam.id) }, passed: true }, select: { examId: true } }) : [];
  const passed = new Set(passes.map((attempt) => attempt.examId));
  const items = allowed.map((exam) => ({ id: exam.id, title: exam.title, subject: exam.subject, status: exam.status,
    state: passed.has(exam.id) ? "unavailable" as const : "open" as const,
    locked: passed.has(exam.id), href: passed.has(exam.id) ? null : `/student/exams/${encodeURIComponent(exam.id)}`,
    ...(passed.has(exam.id) ? { reason: "This check is already completed" } : {}),
  }));
  return { availability: items.length ? "current" as const : "empty" as const, total: items.length, items };
}
