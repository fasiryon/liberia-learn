import { type Weekday } from "@prisma/client";
import { prisma } from "@/lib/db";

// UTC day index (0=Sunday … 6=Saturday) → Weekday enum
const UTC_DAY_TO_WEEKDAY: Record<number, Weekday> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Strip time from a Date to get the calendar-day Date (UTC midnight). */
function utcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function weekdayFor(date: Date): Weekday {
  return UTC_DAY_TO_WEEKDAY[date.getUTCDay()];
}

/** Convert "08:30" to "8:30 AM" for student-facing display. */
export function formatTo12Hour(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

export type TimetablePeriod = {
  id: string;
  periodLabel: string;
  subject: string | null;
  startTime: string | null;
  endTime: string | null;
  teacherName: string | null;
  assignment: {
    id: string;
    title: string;
    contentId: string | null;
    lessonUrl: string | null;
    instructions: string | null;
  } | null;
};

export type TimetableForDay = {
  configured: boolean;
  date: string;
  dayName: string;
  periods: TimetablePeriod[];
};

export type TeacherTimetablePeriod = {
  id: string;
  classId: string;
  className: string | null;
  periodLabel: string;
  subject: string;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  assignment: {
    id: string;
    title: string;
    contentId: string | null;
    instructions: string | null;
  } | null;
};

function sortByStartTime<T extends { startTime: string | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    if (!a.startTime && !b.startTime) return 0;
    if (!a.startTime) return 1;
    if (!b.startTime) return -1;
    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Returns the timetable for a student on a given date.
 * Uses the student's class enrollments to find matching timetable slots.
 * Returns null (no timetable configured) if the student has no enrollments
 * or no timetable entries exist for their classes on that weekday.
 */
export async function getTimetableForStudent(
  studentId: string,
  date: Date
): Promise<TimetableForDay | null> {
  const weekday = weekdayFor(date);
  const dateOnly = utcDateOnly(date);

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classId: true },
  });

  if (enrollments.length === 0) return null;
  const classIds = enrollments.map((e) => e.classId);

  const slots = await prisma.timetable.findMany({
    where: { classId: { in: classIds }, dayOfWeek: weekday },
    include: {
      teacher: { select: { id: true, name: true } },
      assignments: {
        where: { assignedDate: dateOnly },
        select: {
          id: true,
          title: true,
          curriculumContentId: true,
          instructions: true,
        },
      },
    },
  });

  if (slots.length === 0) return null;

  const sorted = sortByStartTime(slots);

  const periods: TimetablePeriod[] = sorted.map((slot) => {
    const assignment = slot.assignments[0] ?? null;
    return {
      id: slot.id,
      periodLabel: slot.periodLabel,
      subject: slot.subject,
      startTime: slot.startTime ?? null,
      endTime: slot.endTime ?? null,
      teacherName: slot.teacher?.name ?? null,
      assignment: assignment
        ? {
            id: assignment.id,
            title: assignment.title,
            contentId: assignment.curriculumContentId ?? null,
            lessonUrl: assignment.curriculumContentId
              ? `/student/lessons/${assignment.curriculumContentId}`
              : null,
            instructions: assignment.instructions ?? null,
          }
        : null,
    };
  });

  return {
    configured: true,
    date: dateOnly.toISOString().split("T")[0],
    dayName: DAY_NAMES[date.getUTCDay()],
    periods,
  };
}

/**
 * Returns the timetable for a teacher on a given date (all their slots).
 * Scoped to schoolId to prevent cross-school data leakage.
 */
export async function getTimetableForTeacher(
  teacherId: string,
  schoolId: string,
  date: Date
): Promise<TeacherTimetablePeriod[]> {
  const weekday = weekdayFor(date);
  const dateOnly = utcDateOnly(date);

  const slots = await prisma.timetable.findMany({
    where: { teacherId, schoolId, dayOfWeek: weekday },
    include: {
      class: { select: { id: true, name: true } },
      assignments: {
        where: { assignedDate: dateOnly },
        select: {
          id: true,
          title: true,
          curriculumContentId: true,
          instructions: true,
        },
      },
    },
  });

  const sorted = sortByStartTime(slots);

  return sorted.map((slot) => {
    const assignment = slot.assignments[0] ?? null;
    return {
      id: slot.id,
      classId: slot.classId,
      className: slot.class?.name ?? null,
      periodLabel: slot.periodLabel,
      subject: slot.subject,
      startTime: slot.startTime ?? null,
      endTime: slot.endTime ?? null,
      room: slot.room ?? null,
      assignment: assignment
        ? {
            id: assignment.id,
            title: assignment.title,
            contentId: assignment.curriculumContentId ?? null,
            instructions: assignment.instructions ?? null,
          }
        : null,
    };
  });
}

/**
 * Assigns (or replaces) a lesson on a timetable slot for a specific date.
 * Validates that the teacher owns this slot at their school.
 */
export async function assignLessonToSlot(
  timetableId: string,
  teacherUserId: string,
  schoolId: string,
  data: {
    assignedDate: Date;
    title: string;
    curriculumContentId: string | null;
    instructions: string | null;
  }
): Promise<{ id: string }> {
  const slot = await prisma.timetable.findFirst({
    where: { id: timetableId, schoolId, teacherId: teacherUserId },
    select: { id: true },
  });

  if (!slot) {
    throw Object.assign(
      new Error(
        "Timetable slot not found or you do not have permission to assign to it."
      ),
      { status: 404 }
    );
  }

  const dateOnly = utcDateOnly(data.assignedDate);

  const assignment = await prisma.timetableAssignment.upsert({
    where: {
      timetableId_assignedDate: {
        timetableId,
        assignedDate: dateOnly,
      },
    },
    create: {
      timetableId,
      curriculumContentId: data.curriculumContentId ?? null,
      assignedById: teacherUserId,
      assignedDate: dateOnly,
      title: data.title,
      instructions: data.instructions ?? null,
    },
    update: {
      curriculumContentId: data.curriculumContentId ?? null,
      title: data.title,
      instructions: data.instructions ?? null,
      updatedAt: new Date(),
    },
    select: { id: true },
  });

  return assignment;
}

/**
 * Removes a lesson assignment from a timetable slot on a specific date.
 */
export async function removeLessonFromSlot(
  timetableId: string,
  teacherUserId: string,
  schoolId: string,
  assignedDate: Date
): Promise<void> {
  const slot = await prisma.timetable.findFirst({
    where: { id: timetableId, schoolId, teacherId: teacherUserId },
    select: { id: true },
  });

  if (!slot) {
    throw Object.assign(
      new Error(
        "Timetable slot not found or you do not have permission to modify it."
      ),
      { status: 404 }
    );
  }

  const dateOnly = utcDateOnly(assignedDate);

  await prisma.timetableAssignment.deleteMany({
    where: { timetableId, assignedDate: dateOnly },
  });
}
