import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  buildPromotionFoundation,
  canTransitionEnrollmentStatus,
  enrollmentStatusSchema,
} from "@/lib/records/promotion";

const isoDateSchema = z.coerce.date();

export const termInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

export const createAcademicYearSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  yearLabel: z.string().trim().min(4).max(32),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  isActive: z.boolean().optional().default(false),
  terms: z.array(termInputSchema).min(1).max(6),
});

export const updateAcademicYearSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1),
  isActive: z.boolean().optional(),
});

export const createAcademicEnrollmentSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  grade: z.coerce.number().int().min(1).max(12),
  status: enrollmentStatusSchema.optional().default("ACTIVE"),
});

export const updateAcademicEnrollmentSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  enrollmentId: z.string().trim().min(1),
  status: enrollmentStatusSchema,
});

export const upsertTranscriptSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  studentId: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  grade: z.coerce.number().int().min(1).max(12),
  gpa: z.coerce.number().min(0).max(4).nullable().optional(),
  summary: z.record(z.string(), z.any()).nullable().optional(),
});

export function resolveAdminSchoolScope(
  user: { schoolId?: string | null; isPlatformAdmin?: boolean },
  requestedSchoolId?: string | null
) {
  if (user.isPlatformAdmin) {
    const schoolId = requestedSchoolId ?? user.schoolId ?? null;
    if (!schoolId) {
      throw Object.assign(new Error("schoolId is required"), { status: 400 });
    }
    return schoolId;
  }

  if (!user.schoolId) {
    throw Object.assign(new Error("schoolId is required"), { status: 400 });
  }

  if (requestedSchoolId && requestedSchoolId !== user.schoolId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  return user.schoolId;
}

function assertDateRange(startDate: Date, endDate: Date) {
  if (startDate >= endDate) {
    throw Object.assign(new Error("startDate must be before endDate"), { status: 400 });
  }
}

function mapAcademicYear(record: any) {
  return {
    id: record.id,
    schoolId: record.schoolId,
    yearLabel: record.yearLabel,
    startDate: record.startDate,
    endDate: record.endDate,
    isActive: record.isActive,
    createdAt: record.createdAt,
    terms: (record.terms ?? []).map((term: any) => ({
      id: term.id,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      createdAt: term.createdAt,
    })),
  };
}

function mapTranscript(record: any) {
  return {
    id: record.id,
    studentId: record.studentId,
    schoolId: record.schoolId,
    academicYearId: record.academicYearId,
    academicYearLabel: record.academicYear?.yearLabel ?? null,
    grade: record.grade,
    gpa: record.gpa,
    summary: record.summary ?? null,
    createdAt: record.createdAt,
    student: record.student
      ? {
          id: record.student.id,
          name: record.student.user?.name ?? record.student.user?.email ?? "Student",
          currentGrade: record.student.currentGrade ?? null,
        }
      : null,
  };
}

function mapAcademicEnrollment(record: any) {
  return {
    id: record.id,
    studentId: record.studentId,
    schoolId: record.schoolId,
    academicYearId: record.academicYearId,
    academicYearLabel: record.academicYear?.yearLabel ?? null,
    grade: record.grade,
    status: record.status,
    createdAt: record.createdAt,
    promotion: buildPromotionFoundation({
      currentGrade: record.grade,
      status: record.status,
    }),
    student: record.student
      ? {
          id: record.student.id,
          name: record.student.user?.name ?? record.student.user?.email ?? "Student",
          currentGrade: record.student.currentGrade ?? null,
        }
      : null,
  };
}

export async function listAcademicYearsForSchool(schoolId: string) {
  const rows = await prisma.academicYear.findMany({
    where: { schoolId },
    include: {
      terms: {
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
  });

  return rows.map(mapAcademicYear);
}

export async function createAcademicYearForSchool(
  schoolId: string,
  input: z.infer<typeof createAcademicYearSchema>
) {
  assertDateRange(input.startDate, input.endDate);
  input.terms.forEach((term) => assertDateRange(term.startDate, term.endDate));

  const record = await prisma.$transaction(async (tx) => {
    if (input.isActive) {
      await tx.academicYear.updateMany({
        where: { schoolId, isActive: true },
        data: { isActive: false },
      });
    }

    return tx.academicYear.create({
      data: {
        schoolId,
        yearLabel: input.yearLabel,
        startDate: input.startDate,
        endDate: input.endDate,
        isActive: input.isActive,
        terms: {
          create: input.terms.map((term) => ({
            name: term.name,
            startDate: term.startDate,
            endDate: term.endDate,
          })),
        },
      },
      include: {
        terms: {
          orderBy: { startDate: "asc" },
        },
      },
    });
  });

  return mapAcademicYear(record);
}

export async function activateAcademicYearForSchool(schoolId: string, academicYearId: string) {
  const existing = await prisma.academicYear.findFirst({
    where: { id: academicYearId, schoolId },
    include: { terms: { orderBy: { startDate: "asc" } } },
  });

  if (!existing) {
    throw Object.assign(new Error("Academic year not found"), { status: 404 });
  }

  const record = await prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({
      where: { schoolId, isActive: true },
      data: { isActive: false },
    });

    return tx.academicYear.update({
      where: { id: academicYearId },
      data: { isActive: true },
      include: {
        terms: {
          orderBy: { startDate: "asc" },
        },
      },
    });
  });

  return mapAcademicYear(record);
}

export async function listAcademicEnrollmentsForSchool(schoolId: string) {
  const rows = await prisma.academicEnrollment.findMany({
    where: { schoolId },
    include: {
      academicYear: true,
      student: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return rows.map(mapAcademicEnrollment);
}

export async function createAcademicEnrollmentForSchool(
  schoolId: string,
  input: z.infer<typeof createAcademicEnrollmentSchema>
) {
  const [student, academicYear] = await Promise.all([
    prisma.student.findFirst({
      where: { id: input.studentId, user: { schoolId } },
      select: { id: true, currentGrade: true, user: { select: { name: true, email: true } } },
    }),
    prisma.academicYear.findFirst({
      where: { id: input.academicYearId, schoolId },
      select: { id: true, yearLabel: true },
    }),
  ]);

  if (!student) {
    throw Object.assign(new Error("Student not found"), { status: 404 });
  }
  if (!academicYear) {
    throw Object.assign(new Error("Academic year not found"), { status: 404 });
  }

  const record = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.academicEnrollment.create({
      data: {
        schoolId,
        studentId: input.studentId,
        academicYearId: input.academicYearId,
        grade: input.grade,
        status: input.status,
      },
      include: {
        academicYear: true,
        student: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    await tx.transcript.upsert({
      where: {
        studentId_academicYearId: {
          studentId: input.studentId,
          academicYearId: input.academicYearId,
        },
      },
      update: {
        grade: input.grade,
      },
      create: {
        studentId: input.studentId,
        schoolId,
        academicYearId: input.academicYearId,
        grade: input.grade,
      },
    });

    return enrollment;
  });

  return mapAcademicEnrollment(record);
}

export async function updateAcademicEnrollmentStatusForSchool(
  schoolId: string,
  enrollmentId: string,
  status: z.infer<typeof enrollmentStatusSchema>
) {
  const existing = await prisma.academicEnrollment.findFirst({
    where: { id: enrollmentId, schoolId },
    include: {
      academicYear: true,
      student: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!existing) {
    throw Object.assign(new Error("Enrollment not found"), { status: 404 });
  }

  if (!canTransitionEnrollmentStatus(existing.status as any, status)) {
    throw Object.assign(new Error("Invalid enrollment status transition"), { status: 400 });
  }

  const record = await prisma.academicEnrollment.update({
    where: { id: enrollmentId },
    data: { status },
    include: {
      academicYear: true,
      student: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return mapAcademicEnrollment(record);
}

export async function listTranscriptsForSchool(schoolId: string, studentId?: string | null) {
  const rows = await prisma.transcript.findMany({
    where: {
      schoolId,
      ...(studentId ? { studentId } : {}),
    },
    include: {
      academicYear: true,
      student: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [{ academicYear: { startDate: "desc" } }, { createdAt: "desc" }],
  });

  return rows.map(mapTranscript);
}

export async function upsertTranscriptForSchool(
  schoolId: string,
  input: z.infer<typeof upsertTranscriptSchema>
) {
  const [student, academicYear] = await Promise.all([
    prisma.student.findFirst({
      where: { id: input.studentId, user: { schoolId } },
      select: { id: true },
    }),
    prisma.academicYear.findFirst({
      where: { id: input.academicYearId, schoolId },
      select: { id: true },
    }),
  ]);

  if (!student) {
    throw Object.assign(new Error("Student not found"), { status: 404 });
  }
  if (!academicYear) {
    throw Object.assign(new Error("Academic year not found"), { status: 404 });
  }

  const record = await prisma.transcript.upsert({
    where: {
      studentId_academicYearId: {
        studentId: input.studentId,
        academicYearId: input.academicYearId,
      },
    },
    update: {
      grade: input.grade,
      gpa: input.gpa ?? null,
      summary: (input.summary as Prisma.InputJsonValue | null | undefined) ?? null,
      schoolId,
    },
    create: {
      studentId: input.studentId,
      schoolId,
      academicYearId: input.academicYearId,
      grade: input.grade,
      gpa: input.gpa ?? null,
      summary: (input.summary as Prisma.InputJsonValue | null | undefined) ?? null,
    },
    include: {
      academicYear: true,
      student: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return mapTranscript(record);
}

export async function listStudentTranscriptsForUser(userId: string) {
  const student = await prisma.student.findUnique({
    where: { userId },
    select: { id: true, user: { select: { schoolId: true } } },
  });

  if (!student?.user.schoolId) {
    return [];
  }

  return listTranscriptsForSchool(student.user.schoolId, student.id);
}
