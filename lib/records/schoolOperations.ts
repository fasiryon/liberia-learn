import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

const isoDateSchema = z.coerce.date();

const subjectValues = [
  "MATH",
  "SCIENCE",
  "COMPUTER_SCIENCE",
  "ENGINEERING",
  "LITERACY",
  "CIVICS",
  "ARTS",
  "PE",
  "CAREER",
] as const;

const weekdayValues = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const attendanceStatusValues = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

export const subjectSchema = z.enum(subjectValues);
export const weekdaySchema = z.enum(weekdayValues);
export const attendanceStatusSchema = z.enum(attendanceStatusValues);

export const createTeacherAssignmentSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1),
  classId: z.string().trim().min(1),
  subject: subjectSchema,
  isPrimary: z.boolean().optional().default(false),
});

export const updateTeacherAssignmentSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  assignmentId: z.string().trim().min(1),
  teacherId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1).optional(),
  subject: subjectSchema.optional(),
  isPrimary: z.boolean().optional(),
});

export const deleteTeacherAssignmentSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  assignmentId: z.string().trim().min(1),
});

export const createTimetableSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  classId: z.string().trim().min(1),
  teacherId: z.string().trim().min(1),
  subject: subjectSchema,
  dayOfWeek: weekdaySchema,
  periodLabel: z.string().trim().min(1).max(40),
  startTime: z.string().trim().min(1).max(16).optional().nullable(),
  endTime: z.string().trim().min(1).max(16).optional().nullable(),
  room: z.string().trim().min(1).max(80).optional().nullable(),
});

export const updateTimetableSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  timetableId: z.string().trim().min(1),
  classId: z.string().trim().min(1).optional(),
  teacherId: z.string().trim().min(1).optional(),
  subject: subjectSchema.optional(),
  dayOfWeek: weekdaySchema.optional(),
  periodLabel: z.string().trim().min(1).max(40).optional(),
  startTime: z.string().trim().max(16).optional().nullable(),
  endTime: z.string().trim().max(16).optional().nullable(),
  room: z.string().trim().max(80).optional().nullable(),
});

export const deleteTimetableSchema = z.object({
  schoolId: z.string().trim().min(1).optional(),
  timetableId: z.string().trim().min(1),
});

export const upsertAttendanceSchema = z.object({
  classId: z.string().trim().min(1),
  date: isoDateSchema,
  records: z
    .array(
      z.object({
        studentId: z.string().trim().min(1),
        status: attendanceStatusSchema,
        notes: z.string().trim().max(240).optional().nullable(),
      })
    )
    .min(1),
});

function startOfUtcDay(date: Date) {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  return value;
}

function mapTeacherRef(record: { id: string; name: string | null; email: string }) {
  return {
    id: record.id,
    name: record.name ?? record.email ?? "Teacher",
  };
}

function mapClassRef(record: { id: string; name: string; subject: string }) {
  return {
    id: record.id,
    name: record.name,
    subject: record.subject,
  };
}

function mapAssignment(record: any) {
  return {
    id: record.id,
    schoolId: record.schoolId,
    teacherId: record.teacherId,
    classId: record.classId,
    subject: record.subject,
    isPrimary: record.isPrimary,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    teacher: record.teacher ? mapTeacherRef(record.teacher) : null,
    class: record.class ? mapClassRef(record.class) : null,
  };
}

function mapTimetable(record: any) {
  return {
    id: record.id,
    schoolId: record.schoolId,
    classId: record.classId,
    teacherId: record.teacherId,
    subject: record.subject,
    dayOfWeek: record.dayOfWeek,
    periodLabel: record.periodLabel,
    startTime: record.startTime ?? null,
    endTime: record.endTime ?? null,
    room: record.room ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    teacher: record.teacher ? mapTeacherRef(record.teacher) : null,
    class: record.class ? mapClassRef(record.class) : null,
  };
}

function mapAttendance(record: any) {
  return {
    id: record.id,
    studentId: record.studentId,
    classId: record.classId,
    schoolId: record.schoolId,
    date: record.date,
    status: record.status,
    markedById: record.markedById,
    notes: record.notes ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function ensureTeacherAndClassInSchool(schoolId: string, teacherId: string, classId: string) {
  const [teacher, cls] = await Promise.all([
    prisma.user.findFirst({
      where: { id: teacherId, schoolId, role: "TEACHER" },
      select: { id: true },
    }),
    prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, subject: true, teacherId: true },
    }),
  ]);

  if (!teacher) {
    throw Object.assign(new Error("Teacher not found"), { status: 404 });
  }
  if (!cls) {
    throw Object.assign(new Error("Class not found"), { status: 404 });
  }

  return { cls };
}

export async function listOperationalReferencesForSchool(schoolId: string) {
  const [teachers, classes] = await Promise.all([
    prisma.user.findMany({
      where: { schoolId, role: "TEACHER" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.class.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subject: true },
    }),
  ]);

  return {
    teachers: teachers.map(mapTeacherRef),
    classes: classes.map(mapClassRef),
  };
}

export async function listTeacherAssignmentsForSchool(schoolId: string) {
  const rows = await prisma.teacherAssignment.findMany({
    where: { schoolId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      class: { select: { id: true, name: true, subject: true } },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(mapAssignment);
}

export async function createTeacherAssignmentForSchool(
  schoolId: string,
  input: z.infer<typeof createTeacherAssignmentSchema>
) {
  await ensureTeacherAndClassInSchool(schoolId, input.teacherId, input.classId);

  const record = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.teacherAssignment.updateMany({
        where: {
          schoolId,
          classId: input.classId,
          subject: input.subject,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    return tx.teacherAssignment.create({
      data: {
        schoolId,
        teacherId: input.teacherId,
        classId: input.classId,
        subject: input.subject,
        isPrimary: input.isPrimary,
      },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        class: { select: { id: true, name: true, subject: true } },
      },
    });
  });

  return mapAssignment(record);
}

export async function updateTeacherAssignmentForSchool(
  schoolId: string,
  input: z.infer<typeof updateTeacherAssignmentSchema>
) {
  const existing = await prisma.teacherAssignment.findFirst({
    where: { id: input.assignmentId, schoolId },
    select: { id: true, classId: true, teacherId: true, subject: true },
  });

  if (!existing) {
    throw Object.assign(new Error("Teacher assignment not found"), { status: 404 });
  }

  const nextTeacherId = input.teacherId ?? existing.teacherId;
  const nextClassId = input.classId ?? existing.classId;
  const nextSubject = input.subject ?? existing.subject;

  await ensureTeacherAndClassInSchool(schoolId, nextTeacherId, nextClassId);

  const record = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.teacherAssignment.updateMany({
        where: {
          schoolId,
          classId: nextClassId,
          subject: nextSubject,
          isPrimary: true,
          NOT: { id: input.assignmentId },
        },
        data: { isPrimary: false },
      });
    }

    return tx.teacherAssignment.update({
      where: { id: input.assignmentId },
      data: {
        teacherId: nextTeacherId,
        classId: nextClassId,
        subject: nextSubject,
        ...(typeof input.isPrimary === "boolean" ? { isPrimary: input.isPrimary } : {}),
      },
      include: {
        teacher: { select: { id: true, name: true, email: true } },
        class: { select: { id: true, name: true, subject: true } },
      },
    });
  });

  return mapAssignment(record);
}

export async function deleteTeacherAssignmentForSchool(schoolId: string, assignmentId: string) {
  const existing = await prisma.teacherAssignment.findFirst({
    where: { id: assignmentId, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw Object.assign(new Error("Teacher assignment not found"), { status: 404 });
  }

  await prisma.teacherAssignment.delete({ where: { id: assignmentId } });
}

export async function listTimetableForSchool(schoolId: string) {
  const rows = await prisma.timetable.findMany({
    where: { schoolId },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      class: { select: { id: true, name: true, subject: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { periodLabel: "asc" }, { createdAt: "asc" }],
  });

  return rows.map(mapTimetable);
}

export async function createTimetableForSchool(
  schoolId: string,
  input: z.infer<typeof createTimetableSchema>
) {
  await ensureTeacherAndClassInSchool(schoolId, input.teacherId, input.classId);

  const record = await prisma.timetable.create({
    data: {
      schoolId,
      classId: input.classId,
      teacherId: input.teacherId,
      subject: input.subject,
      dayOfWeek: input.dayOfWeek,
      periodLabel: input.periodLabel,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      room: input.room ?? null,
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      class: { select: { id: true, name: true, subject: true } },
    },
  });

  return mapTimetable(record);
}

export async function updateTimetableForSchool(
  schoolId: string,
  input: z.infer<typeof updateTimetableSchema>
) {
  const existing = await prisma.timetable.findFirst({
    where: { id: input.timetableId, schoolId },
    select: {
      id: true,
      classId: true,
      teacherId: true,
      subject: true,
      dayOfWeek: true,
      periodLabel: true,
      startTime: true,
      endTime: true,
      room: true,
    },
  });

  if (!existing) {
    throw Object.assign(new Error("Timetable entry not found"), { status: 404 });
  }

  const nextTeacherId = input.teacherId ?? existing.teacherId;
  const nextClassId = input.classId ?? existing.classId;
  await ensureTeacherAndClassInSchool(schoolId, nextTeacherId, nextClassId);

  const record = await prisma.timetable.update({
    where: { id: input.timetableId },
    data: {
      teacherId: nextTeacherId,
      classId: nextClassId,
      subject: input.subject ?? existing.subject,
      dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
      periodLabel: input.periodLabel ?? existing.periodLabel,
      startTime: input.startTime === undefined ? existing.startTime : input.startTime,
      endTime: input.endTime === undefined ? existing.endTime : input.endTime,
      room: input.room === undefined ? existing.room : input.room,
    },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      class: { select: { id: true, name: true, subject: true } },
    },
  });

  return mapTimetable(record);
}

export async function deleteTimetableForSchool(schoolId: string, timetableId: string) {
  const existing = await prisma.timetable.findFirst({
    where: { id: timetableId, schoolId },
    select: { id: true },
  });

  if (!existing) {
    throw Object.assign(new Error("Timetable entry not found"), { status: 404 });
  }

  await prisma.timetable.delete({ where: { id: timetableId } });
}

async function listAuthorizedClassIdsForTeacher(userId: string, schoolId: string) {
  const teacherAssignmentModel = (prisma as any).teacherAssignment;
  const timetableModel = (prisma as any).timetable;
  const [assignments, timetables] = await Promise.all([
    teacherAssignmentModel?.findMany
      ? teacherAssignmentModel.findMany({
          where: { schoolId, teacherId: userId },
          select: { classId: true },
        })
      : Promise.resolve([]),
    timetableModel?.findMany
      ? timetableModel.findMany({
          where: { schoolId, teacherId: userId },
          select: { classId: true },
        })
      : Promise.resolve([]),
  ]);

  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safeTimetables = Array.isArray(timetables) ? timetables : [];

  return Array.from(
    new Set([
      ...safeAssignments.map((item) => item.classId),
      ...safeTimetables.map((item) => item.classId),
    ])
  );
}

export async function listTeacherScheduleForUser(user: {
  id: string;
  schoolId?: string | null;
  role: string;
}) {
  const timetableModel = (prisma as any).timetable;
  if (!user.schoolId) {
    return {
      classes: [],
      timetable: [],
    };
  }

  let classes: Array<{ id: string; name: string; subject: string }> = [];

  if (user.role === "ADMIN") {
    classes = await prisma.class.findMany({
      where: { schoolId: user.schoolId },
      select: { id: true, name: true, subject: true },
      orderBy: { name: "asc" },
    });
  } else {
    const ownedClasses = await prisma.class.findMany({
      where: { schoolId: user.schoolId, teacherId: user.id },
      select: { id: true, name: true, subject: true },
      orderBy: { name: "asc" },
    });
    const ownedClassIds = ownedClasses.map((row) => row.id);
    const extraClassIds = await listAuthorizedClassIdsForTeacher(user.id, user.schoolId);
    const missingClassIds = extraClassIds.filter((classId) => !ownedClassIds.includes(classId));

    if (missingClassIds.length === 0) {
      classes = ownedClasses;
    } else {
      const extraClasses = await prisma.class.findMany({
        where: { id: { in: missingClassIds } },
        select: { id: true, name: true, subject: true },
        orderBy: { name: "asc" },
      });
      classes = [...ownedClasses, ...extraClasses];
    }
  }

  const classIds = classes.map((row) => row.id);

  if (classIds.length === 0) {
    return {
      classes: [],
      timetable: [],
    };
  }

  const [timetable] = await Promise.all([
    timetableModel?.findMany
      ? timetableModel.findMany({
          where:
            user.role === "ADMIN"
              ? { schoolId: user.schoolId }
              : { schoolId: user.schoolId, OR: [{ teacherId: user.id }, { classId: { in: classIds } }] },
          include: {
            teacher: { select: { id: true, name: true, email: true } },
            class: { select: { id: true, name: true, subject: true } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { periodLabel: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return {
    classes: classes.map(mapClassRef),
    timetable: (Array.isArray(timetable) ? timetable : []).map(mapTimetable),
  };
}

export async function listTeacherAttendanceContext(user: {
  id: string;
  schoolId?: string | null;
  role: string;
}, classId?: string | null, dateInput?: Date) {
  if (!user.schoolId) {
    throw Object.assign(new Error("schoolId is required"), { status: 400 });
  }

  const classIds =
    user.role === "ADMIN"
      ? (
          await prisma.class.findMany({
            where: { schoolId: user.schoolId },
            select: { id: true },
          })
        ).map((row) => row.id)
      : await listAuthorizedClassIdsForTeacher(user.id, user.schoolId);

  const classes = await prisma.class.findMany({
    where: { id: { in: classIds } },
    select: { id: true, name: true, subject: true },
    orderBy: { name: "asc" },
  });

  if (!classId) {
    return {
      classes: classes.map(mapClassRef),
      roster: [],
      attendance: [],
      selectedDate: startOfUtcDay(dateInput ?? new Date()),
    };
  }

  if (!classIds.includes(classId)) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const selectedDate = startOfUtcDay(dateInput ?? new Date());
  const [roster, attendance] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId },
      orderBy: { createdAt: "asc" },
      select: {
        studentId: true,
        Student: {
          select: {
            id: true,
            currentGrade: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.attendance.findMany({
      where: {
        classId,
        schoolId: user.schoolId,
        date: selectedDate,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    classes: classes.map(mapClassRef),
    roster: roster.map((item) => ({
      studentId: item.studentId,
      name: item.Student.user.name ?? item.Student.user.email ?? "Student",
      currentGrade: item.Student.currentGrade ?? null,
    })),
    attendance: attendance.map(mapAttendance),
    selectedDate,
  };
}

export async function upsertAttendanceForTeacher(
  user: { id: string; schoolId?: string | null; role: string },
  input: z.infer<typeof upsertAttendanceSchema>
) {
  if (!user.schoolId) {
    throw Object.assign(new Error("schoolId is required"), { status: 400 });
  }

  const context = await listTeacherAttendanceContext(user, input.classId, input.date);
  const rosterIds = new Set(context.roster.map((item) => item.studentId));
  for (const record of input.records) {
    if (!rosterIds.has(record.studentId)) {
      throw Object.assign(new Error("Student is not enrolled in this class"), { status: 400 });
    }
  }

  const targetDate = startOfUtcDay(input.date);
  const operations = input.records.map((record) =>
    prisma.attendance.upsert({
      where: {
        studentId_classId_date: {
          studentId: record.studentId,
          classId: input.classId,
          date: targetDate,
        },
      },
      update: {
        status: record.status,
        notes: record.notes ?? null,
        markedById: user.id,
      },
      create: {
        studentId: record.studentId,
        classId: input.classId,
        schoolId: user.schoolId,
        date: targetDate,
        status: record.status,
        notes: record.notes ?? null,
        markedById: user.id,
      },
    })
  );

  const rows = await prisma.$transaction(operations);
  return rows.map(mapAttendance);
}

export { resolveAdminSchoolScope };
