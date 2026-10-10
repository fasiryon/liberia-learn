import { prisma } from "@/lib/db";
import { learnerRowAllowed, learnerScopeAllows } from "@/lib/curriculum/learnerEligibility";
import { learnerDiscoverySelect } from "@/lib/student/learnDiscovery.server";
import { buildCurriculumDisplayTitle } from "@/lib/curriculum/title";
import { loadStudentClasses, type StudentReaderUser } from "./enrollmentReadModel";

export const SCHEDULE_LIMIT = 200;
export function unavailableStudentSchedule() {
  return { schemaVersion: "student-schedule/1", availability: "unavailable", freshness: "unavailable",
    periods: [], scheduledWork: [], generatedAt: new Date().toISOString() };
}

/** Existing recurring timetable and dated scheduled work, bounded to a 14-day window. No writes. */
export async function loadStudentSchedule(user: StudentReaderUser, now = new Date()) {
  const classes = await loadStudentClasses(user);
  const classIds = classes.map((c) => c.classId);
  const start = new Date(now.getTime() - 7 * 86400000);
  const end = new Date(now.getTime() + 7 * 86400000);
  const [periods, work] = classIds.length ? await Promise.all([
    prisma.timetable.findMany({ where: { schoolId: user.schoolId!, classId: { in: classIds }, class: { schoolId: user.schoolId! } },
      select: { id: true, classId: true, dayOfWeek: true, periodLabel: true, startTime: true, endTime: true, room: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { id: "asc" }], take: SCHEDULE_LIMIT + 1 }),
    prisma.scheduledWork.findMany({ where: { classId: { in: classIds }, class: { schoolId: user.schoolId! },
      OR: [{ status: null }, { status: "confirmed" }], scheduledDate: { gte: start, lte: end } },
      select: { id: true, classId: true, scheduledDate: true, startTime: true, endTime: true, periodNumber: true,
        content: { select: learnerDiscoverySelect } },
      orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }, { id: "asc" }], take: SCHEDULE_LIMIT + 1 }),
  ]) : [[], []];
  const scheduledWork = [];
  for (const row of work.slice(0, SCHEDULE_LIMIT)) {
    const allowed = ["published", "APPROVED"].includes(row.content.status) && learnerRowAllowed(row.content) &&
      await learnerScopeAllows(prisma, row.content, { schoolId: user.schoolId ?? null, classIds });
    scheduledWork.push({ scheduledWorkId: row.id, classId: row.classId, scheduledDate: row.scheduledDate.toISOString(),
      startTime: row.startTime, endTime: row.endTime, periodNumber: row.periodNumber,
      // A display title is projected only for a row that passed the same gates as its action.
      title: allowed && typeof row.content.subject === "string" && Number.isInteger(row.content.grade)
        ? buildCurriculumDisplayTitle({ title: row.content.title, subject: row.content.subject, gradeLevel: row.content.grade, payload: row.content.payload }) : null,
      action: allowed ? { kind: "lesson", href: `/student/work/${encodeURIComponent(row.id)}` } : null });
  }
  return { schemaVersion: "student-schedule/1", availability: periods.length || work.length ? "configured" : "no_schedule_configured",
    freshness: "current", generatedAt: now.toISOString(), window: { start: start.toISOString(), end: end.toISOString() },
    periods: periods.slice(0, SCHEDULE_LIMIT), scheduledWork,
    limits: { perSource: SCHEDULE_LIMIT, truncated: periods.length > SCHEDULE_LIMIT || work.length > SCHEDULE_LIMIT } };
}
