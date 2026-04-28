import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export type PromotionCandidate = {
  studentId: string;
  studentName: string;
  currentGrade: number;
  nextGrade: number;
  willGraduate: boolean;
  enrollmentId: string;
};

export type PromotionResult = {
  promoted: string[];
  skipped: string[];
  errors: Array<{ studentId: string; reason: string }>;
};

/**
 * Returns all students with ACTIVE enrollment in the given academic year.
 * Does NOT write to the database.
 */
export async function previewPromotions(
  schoolId: string,
  academicYearId: string
): Promise<PromotionCandidate[]> {
  const enrollments = await prisma.academicEnrollment.findMany({
    where: { schoolId, academicYearId, status: "ACTIVE" },
    include: {
      student: {
        include: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { grade: "asc" },
  });

  return enrollments.map((e) => ({
    studentId: e.studentId,
    studentName: e.student.user.name ?? e.student.user.email ?? "Student",
    currentGrade: e.grade,
    nextGrade: e.grade >= 12 ? 12 : e.grade + 1,
    willGraduate: e.grade >= 12,
    enrollmentId: e.id,
  }));
}

/**
 * Promotes students from sourceAcademicYearId to targetAcademicYearId (grade + 1).
 * Old enrollment is marked PROMOTED; new enrollment is created in the target year.
 * student.currentGrade is updated to preserve backward compatibility.
 * Idempotent: if student already has ACTIVE enrollment in target year, they are skipped.
 */
export async function promoteStudents(
  schoolId: string,
  sourceAcademicYearId: string,
  targetAcademicYearId: string,
  studentIds: string[],
  actingUserId: string
): Promise<PromotionResult> {
  const result: PromotionResult = { promoted: [], skipped: [], errors: [] };

  for (const studentId of studentIds) {
    try {
      // Tenant check
      const student = await prisma.student.findFirst({
        where: { id: studentId, user: { schoolId } },
        select: { id: true, currentGrade: true },
      });
      if (!student) {
        result.errors.push({ studentId, reason: "Student not found in this school" });
        continue;
      }

      // Find current active enrollment
      const currentEnrollment = await prisma.academicEnrollment.findFirst({
        where: { studentId, schoolId, academicYearId: sourceAcademicYearId, status: "ACTIVE" },
      });
      if (!currentEnrollment) {
        result.errors.push({ studentId, reason: "No active enrollment in source academic year" });
        continue;
      }

      if (currentEnrollment.grade >= 12) {
        result.errors.push({ studentId, reason: "Grade 12 students must use the graduate endpoint" });
        continue;
      }

      // Idempotency: skip if already promoted to target year
      const existing = await prisma.academicEnrollment.findFirst({
        where: { studentId, schoolId, academicYearId: targetAcademicYearId, status: "ACTIVE" },
      });
      if (existing) {
        result.skipped.push(studentId);
        continue;
      }

      const nextGrade = currentEnrollment.grade + 1;

      await prisma.$transaction(async (tx) => {
        await tx.academicEnrollment.update({
          where: { id: currentEnrollment.id },
          data: { status: "PROMOTED", promotedAt: new Date() },
        });

        await tx.academicEnrollment.create({
          data: {
            studentId,
            schoolId,
            academicYearId: targetAcademicYearId,
            grade: nextGrade,
            status: "ACTIVE",
            promotedAt: new Date(),
          },
        });

        // Keep student.currentGrade in sync — required for backward compatibility
        await tx.student.update({
          where: { id: studentId },
          data: { currentGrade: nextGrade },
        });

        await tx.transcript.upsert({
          where: { studentId_academicYearId: { studentId, academicYearId: targetAcademicYearId } },
          update: { grade: nextGrade },
          create: { studentId, schoolId, academicYearId: targetAcademicYearId, grade: nextGrade },
        });
      });

      result.promoted.push(studentId);
    } catch (err: any) {
      result.errors.push({ studentId, reason: err?.message ?? "Unexpected error" });
    }
  }

  logAudit({
    userId: actingUserId,
    action: "admin.students.promoted",
    resourceType: "academic_enrollment",
    resourceId: schoolId,
    schoolId,
    details: {
      promoted: result.promoted.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
    },
  });

  return result;
}

/**
 * Retains students at the same grade level into targetAcademicYearId.
 * Old enrollment is marked COMPLETED; new enrollment at same grade is created.
 * student.currentGrade is unchanged.
 */
export async function retainStudents(
  schoolId: string,
  sourceAcademicYearId: string,
  targetAcademicYearId: string,
  studentIds: string[],
  actingUserId: string
): Promise<PromotionResult> {
  const result: PromotionResult = { promoted: [], skipped: [], errors: [] };

  for (const studentId of studentIds) {
    try {
      const student = await prisma.student.findFirst({
        where: { id: studentId, user: { schoolId } },
        select: { id: true },
      });
      if (!student) {
        result.errors.push({ studentId, reason: "Student not found in this school" });
        continue;
      }

      const currentEnrollment = await prisma.academicEnrollment.findFirst({
        where: { studentId, schoolId, academicYearId: sourceAcademicYearId, status: "ACTIVE" },
      });
      if (!currentEnrollment) {
        result.errors.push({ studentId, reason: "No active enrollment in source academic year" });
        continue;
      }

      // Idempotency: skip if already enrolled in target year
      const existing = await prisma.academicEnrollment.findFirst({
        where: { studentId, schoolId, academicYearId: targetAcademicYearId },
      });
      if (existing) {
        result.skipped.push(studentId);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.academicEnrollment.update({
          where: { id: currentEnrollment.id },
          data: { status: "COMPLETED" },
        });

        await tx.academicEnrollment.create({
          data: {
            studentId,
            schoolId,
            academicYearId: targetAcademicYearId,
            grade: currentEnrollment.grade,
            status: "ACTIVE",
          },
        });
        // student.currentGrade intentionally unchanged (same grade)
      });

      result.promoted.push(studentId);
    } catch (err: any) {
      result.errors.push({ studentId, reason: err?.message ?? "Unexpected error" });
    }
  }

  logAudit({
    userId: actingUserId,
    action: "admin.students.retained",
    resourceType: "academic_enrollment",
    resourceId: schoolId,
    schoolId,
    details: { retained: result.promoted.length, errors: result.errors.length },
  });

  return result;
}

/**
 * Graduates Grade 12 students. Only valid for grade = 12.
 * Marks enrollment as GRADUATED; student.currentGrade stays at 12.
 */
export async function graduateStudents(
  schoolId: string,
  academicYearId: string,
  studentIds: string[],
  actingUserId: string
): Promise<PromotionResult> {
  const result: PromotionResult = { promoted: [], skipped: [], errors: [] };

  for (const studentId of studentIds) {
    try {
      const student = await prisma.student.findFirst({
        where: { id: studentId, user: { schoolId } },
        select: { id: true },
      });
      if (!student) {
        result.errors.push({ studentId, reason: "Student not found in this school" });
        continue;
      }

      const currentEnrollment = await prisma.academicEnrollment.findFirst({
        where: { studentId, schoolId, academicYearId, status: "ACTIVE" },
      });
      if (!currentEnrollment) {
        result.errors.push({ studentId, reason: "No active enrollment in this academic year" });
        continue;
      }

      if (currentEnrollment.grade !== 12) {
        result.errors.push({ studentId, reason: "Only Grade 12 students can be graduated" });
        continue;
      }

      await prisma.academicEnrollment.update({
        where: { id: currentEnrollment.id },
        data: { status: "GRADUATED", promotedAt: new Date() },
      });

      result.promoted.push(studentId);
    } catch (err: any) {
      result.errors.push({ studentId, reason: err?.message ?? "Unexpected error" });
    }
  }

  logAudit({
    userId: actingUserId,
    action: "admin.students.graduated",
    resourceType: "academic_enrollment",
    resourceId: schoolId,
    schoolId,
    details: { graduated: result.promoted.length, errors: result.errors.length },
  });

  return result;
}
