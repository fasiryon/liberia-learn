import { prisma } from "@/lib/db";

export type ClassWeeklySummary = {
  classId: string;
  className: string;
  lessonCount: number;
  lessonCompletionRate: number; // 0–100
  assignmentSubmissionRate: number; // 0–100
  absencesThisWeek: number;
  atRiskStudentCount: number;
  enrolledStudentCount: number;
};

export type TeacherWeeklyReport = {
  teacherId: string;
  weekStart: string; // ISO date (Monday)
  weekEnd: string;   // ISO date (Sunday)
  generatedAt: string;
  classes: ClassWeeklySummary[];
  totalLessons: number;
  totalAbsences: number;
  overallCompletionRate: number; // weighted average across classes
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday-based
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function buildTeacherWeeklyReport(
  teacherId: string,
  schoolId: string,
  referenceDate: Date = new Date()
): Promise<TeacherWeeklyReport> {
  const weekStart = startOfWeek(referenceDate);
  const weekEnd = endOfWeek(weekStart);

  // Fetch all classes the teacher owns in this school
  const classes = await prisma.class.findMany({
    where: { teacherId, schoolId },
    select: { id: true, name: true },
  });

  if (classes.length === 0) {
    return {
      teacherId,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      generatedAt: new Date().toISOString(),
      classes: [],
      totalLessons: 0,
      totalAbsences: 0,
      overallCompletionRate: 0,
    };
  }

  const classIds = classes.map((c) => c.id);

  // Enrolled students per class
  const enrollments = await prisma.enrollment.findMany({
    where: { classId: { in: classIds } },
    select: { classId: true, studentId: true },
  });
  const enrolledByClass = new Map<string, number>();
  for (const e of enrollments) {
    enrolledByClass.set(e.classId, (enrolledByClass.get(e.classId) ?? 0) + 1);
  }

  // Scheduled lessons this week
  const scheduledWork = await prisma.scheduledWork.findMany({
    where: {
      classId: { in: classIds },
      scheduledDate: { gte: weekStart, lte: weekEnd },
    },
    select: { id: true, classId: true },
  });
  const lessonsByClass = new Map<string, string[]>();
  for (const sw of scheduledWork) {
    const existing = lessonsByClass.get(sw.classId) ?? [];
    existing.push(sw.id);
    lessonsByClass.set(sw.classId, existing);
  }

  // Student progress completions this week
  const completedWork = scheduledWork.length > 0
    ? await prisma.studentProgress.findMany({
        where: {
          scheduledWorkId: { in: scheduledWork.map((s) => s.id) },
          completedAt: { not: null, gte: weekStart, lte: weekEnd },
        },
        select: { scheduledWorkId: true, studentId: true },
      })
    : [];
  const completionsByWork = new Map<string, number>();
  for (const cp of completedWork) {
    completionsByWork.set(
      cp.scheduledWorkId,
      (completionsByWork.get(cp.scheduledWorkId) ?? 0) + 1
    );
  }

  // Assignment submissions this week (via AssignmentSubmission)
  const assignmentSubmissions = await (prisma as any).assignmentSubmission.findMany({
    where: {
      assignment: { classId: { in: classIds } },
      submittedAt: { gte: weekStart, lte: weekEnd },
    },
    select: { id: true, assignment: { select: { classId: true } } },
  }).catch(() => [] as any[]);

  const submissionsByClass = new Map<string, number>();
  for (const sub of assignmentSubmissions) {
    const cid = sub.assignment?.classId;
    if (cid) submissionsByClass.set(cid, (submissionsByClass.get(cid) ?? 0) + 1);
  }

  // Absences this week — query Attendance directly (has classId + date + status)
  const absenceRows = await prisma.attendance.findMany({
    where: {
      classId: { in: classIds },
      date: { gte: weekStart, lte: weekEnd },
      status: "ABSENT",
    },
    select: { classId: true },
  });
  const absencesByClass = new Map<string, number>();
  for (const ar of absenceRows) {
    absencesByClass.set(ar.classId, (absencesByClass.get(ar.classId) ?? 0) + 1);
  }

  // At-risk: students with DerivedStudentProgress.isAtRisk = true
  const atRiskRecords = await (prisma as any).derivedStudentProgress.findMany({
    where: {
      classId: { in: classIds },
      isAtRisk: true,
    },
    select: { classId: true, studentId: true },
    distinct: ["classId", "studentId"],
  }).catch(() => [] as any[]);
  const atRiskByClass = new Map<string, number>();
  for (const r of atRiskRecords) {
    if (r.classId) atRiskByClass.set(r.classId, (atRiskByClass.get(r.classId) ?? 0) + 1);
  }

  // Build per-class summaries
  const classSummaries: ClassWeeklySummary[] = classes.map((cls) => {
    const enrolled = enrolledByClass.get(cls.id) ?? 0;
    const lessonIds = lessonsByClass.get(cls.id) ?? [];
    const lessonCount = lessonIds.length;

    // Completion rate = completions / (lessons × enrolled students)
    const expectedCompletions = lessonCount * enrolled;
    const actualCompletions = lessonIds.reduce(
      (sum, wId) => sum + (completionsByWork.get(wId) ?? 0),
      0
    );
    const lessonCompletionRate =
      expectedCompletions > 0
        ? Math.round((actualCompletions / expectedCompletions) * 100)
        : 0;

    // Assignment submission rate = submissions / enrolled (rough proxy)
    const submissions = submissionsByClass.get(cls.id) ?? 0;
    const assignmentSubmissionRate =
      enrolled > 0 ? Math.min(100, Math.round((submissions / enrolled) * 100)) : 0;

    return {
      classId: cls.id,
      className: cls.name,
      lessonCount,
      lessonCompletionRate,
      assignmentSubmissionRate,
      absencesThisWeek: absencesByClass.get(cls.id) ?? 0,
      atRiskStudentCount: atRiskByClass.get(cls.id) ?? 0,
      enrolledStudentCount: enrolled,
    };
  });

  const totalLessons = classSummaries.reduce((s, c) => s + c.lessonCount, 0);
  const totalAbsences = classSummaries.reduce((s, c) => s + c.absencesThisWeek, 0);
  const overallCompletionRate =
    classSummaries.length > 0
      ? Math.round(
          classSummaries.reduce((s, c) => s + c.lessonCompletionRate, 0) /
            classSummaries.length
        )
      : 0;

  return {
    teacherId,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    generatedAt: new Date().toISOString(),
    classes: classSummaries,
    totalLessons,
    totalAbsences,
    overallCompletionRate,
  };
}
