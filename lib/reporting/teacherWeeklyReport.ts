import { prisma } from "@/lib/db";
import { buildTeacherClassPerformance } from "@/lib/reporting/teacherClassPerformance";

export type ClassWeeklySummary = {
  classId: string;
  className: string;
  lessonCount: number;
  lessonCompletionRate: number;
  assignmentSubmissionRate: number;
  averageQuizScore: number | null;
  weakestLessonTitle: string | null;
  absencesThisWeek: number;
  atRiskStudentCount: number;
  enrolledStudentCount: number;
  weakTopics: string[];
  improvingStudents: string[];
  studentsNeedingSupport: string[];
  recommendedNextWeekActions: string[];
};

export type SavedLessonPlanSummary = {
  id: string;
  lessonTitle: string;
  contentId: string | null;
  classId: string | null;
  subject: string | null;
  plannedDate: string | null;
  weekStart: string | null;
  bindingStatus: string;
  slotType: string | null;
  slotId: string | null;
  createdAt: string;
};

export type TeacherWeeklyReport = {
  teacherId: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  classes: ClassWeeklySummary[];
  totalLessons: number;
  totalAbsences: number;
  overallCompletionRate: number;
  savedLessonPlans: SavedLessonPlanSummary[];
};

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
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

  const [classes, performanceIntelligence] = await Promise.all([
    prisma.class.findMany({
      where: { teacherId, schoolId },
      select: { id: true, name: true },
    }),
    buildTeacherClassPerformance(teacherId, schoolId),
  ]);

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
      savedLessonPlans: [],
    };
  }

  const performanceByClassId = new Map(
    performanceIntelligence.map((row) => [row.classId, row] as const)
  );
  const classIds = classes.map((c) => c.id);

  const enrollments = await prisma.enrollment.findMany({
    where: { classId: { in: classIds } },
    select: { classId: true, studentId: true },
  });
  const enrolledByClass = new Map<string, number>();
  for (const e of enrollments) {
    enrolledByClass.set(e.classId, (enrolledByClass.get(e.classId) ?? 0) + 1);
  }

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

  const completedWork =
    scheduledWork.length > 0
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

  const assignmentSubmissions = await (prisma as any).assignmentSubmission
    .findMany({
      where: {
        Assignment: { classId: { in: classIds } },
        turnedInAt: { gte: weekStart, lte: weekEnd },
      },
      select: { id: true, Assignment: { select: { classId: true } } },
    })
    .catch(() => [] as any[]);

  const submissionsByClass = new Map<string, number>();
  for (const sub of assignmentSubmissions) {
    const cid = sub.Assignment?.classId;
    if (cid) {
      submissionsByClass.set(cid, (submissionsByClass.get(cid) ?? 0) + 1);
    }
  }

  const absenceRows = await prisma.attendance.findMany({
    where: {
      classId: { in: classIds },
      date: { gte: weekStart, lte: weekEnd },
      status: "ABSENT",
    },
    select: { classId: true },
  });
  const absencesByClass = new Map<string, number>();
  for (const row of absenceRows) {
    absencesByClass.set(row.classId, (absencesByClass.get(row.classId) ?? 0) + 1);
  }

  const atRiskRecords = await (prisma as any).derivedStudentProgress
    .findMany({
      where: {
        classId: { in: classIds },
        isAtRisk: true,
      },
      select: { classId: true, studentId: true },
      distinct: ["classId", "studentId"],
    })
    .catch(() => [] as any[]);
  const atRiskByClass = new Map<string, number>();
  for (const record of atRiskRecords) {
    if (record.classId) {
      atRiskByClass.set(
        record.classId,
        (atRiskByClass.get(record.classId) ?? 0) + 1
      );
    }
  }

  const savedPlanRows = await (prisma as any).teacherAction
    .findMany({
      where: {
        teacherUserId: teacherId,
        schoolId,
        actionType: "lesson_plan_saved",
        OR: [
          { occurredAt: { gte: weekStart, lte: weekEnd } },
          { classId: { in: classIds } },
        ],
      },
      orderBy: { occurredAt: "desc" },
      take: 25,
    })
    .catch(() => [] as any[]);

  const savedLessonPlans: SavedLessonPlanSummary[] = savedPlanRows
    .map((row: any) => {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const plannedDate = typeof metadata.plannedDate === "string" ? metadata.plannedDate : null;
      const metadataWeekStart = typeof metadata.weekStart === "string" ? metadata.weekStart : null;
      const inPlannedWeek =
        plannedDate == null ||
        (new Date(`${plannedDate}T00:00:00.000Z`) >= weekStart &&
          new Date(`${plannedDate}T00:00:00.000Z`) <= weekEnd);
      const inCreatedWeek = row.occurredAt >= weekStart && row.occurredAt <= weekEnd;
      if (!inPlannedWeek && !inCreatedWeek) return null;
      return {
        id: row.id,
        lessonTitle:
          typeof metadata.lessonTitle === "string" ? metadata.lessonTitle : "Saved lesson plan",
        contentId: row.contentId ?? null,
        classId: row.classId ?? null,
        subject: row.subject ?? null,
        plannedDate,
        weekStart: metadataWeekStart,
        bindingStatus: typeof metadata.bindingStatus === "string" ? metadata.bindingStatus : "needs_review",
        slotType: typeof metadata.slotType === "string" ? metadata.slotType : null,
        slotId: typeof metadata.slotId === "string" ? metadata.slotId : null,
        createdAt: row.occurredAt.toISOString(),
      };
    })
    .filter((row: SavedLessonPlanSummary | null): row is SavedLessonPlanSummary => Boolean(row));

  const classSummaries: ClassWeeklySummary[] = classes.map((cls) => {
    const enrolled = enrolledByClass.get(cls.id) ?? 0;
    const lessonIds = lessonsByClass.get(cls.id) ?? [];
    const lessonCount = lessonIds.length;
    const performance = performanceByClassId.get(cls.id);

    const expectedCompletions = lessonCount * enrolled;
    const actualCompletions = lessonIds.reduce(
      (sum, workId) => sum + (completionsByWork.get(workId) ?? 0),
      0
    );
    const lessonCompletionRate =
      expectedCompletions > 0
        ? Math.round((actualCompletions / expectedCompletions) * 100)
        : 0;

    const submissions = submissionsByClass.get(cls.id) ?? 0;
    const assignmentSubmissionRate =
      enrolled > 0 ? Math.min(100, Math.round((submissions / enrolled) * 100)) : 0;

    return {
      classId: cls.id,
      className: cls.name,
      lessonCount,
      lessonCompletionRate,
      assignmentSubmissionRate,
      averageQuizScore: performance?.averageQuizScore ?? null,
      weakestLessonTitle: performance?.strugglingLesson?.lessonTitle ?? null,
      absencesThisWeek: absencesByClass.get(cls.id) ?? 0,
      atRiskStudentCount: atRiskByClass.get(cls.id) ?? 0,
      enrolledStudentCount: enrolled,
      weakTopics:
        performance?.intelligence?.lowPerformingLessons.map((lesson) => lesson.lessonTitle) ??
        (performance?.strugglingLesson?.lessonTitle ? [performance.strugglingLesson.lessonTitle] : []),
      improvingStudents:
        performance?.intelligence?.topPerformers.map((student) => student.name).slice(0, 5) ??
        performance?.topStudents.map((student) => student.name).slice(0, 5) ??
        [],
      studentsNeedingSupport:
        [
          ...(performance?.intelligence?.strugglingStudents.map((student) => student.name) ?? []),
          ...(performance?.atRiskStudents.map((student) => student.name) ?? []),
        ]
          .filter((name, index, names) => names.indexOf(name) === index)
          .slice(0, 6),
      recommendedNextWeekActions:
        performance?.intelligence?.interventionSuggestions.map((suggestion) => suggestion.label) ??
        [
          lessonCompletionRate < 70 ? "Use the first lesson for completion catch-up." : null,
          performance?.strugglingLesson ? `Reteach ${performance.strugglingLesson.lessonTitle}.` : null,
          (atRiskByClass.get(cls.id) ?? 0) > 0 ? "Check in with students needing support." : null,
        ].filter((action): action is string => Boolean(action)),
    };
  });

  const totalLessons = classSummaries.reduce((sum, row) => sum + row.lessonCount, 0);
  const totalAbsences = classSummaries.reduce(
    (sum, row) => sum + row.absencesThisWeek,
    0
  );
  const overallCompletionRate =
    classSummaries.length > 0
      ? Math.round(
          classSummaries.reduce((sum, row) => sum + row.lessonCompletionRate, 0) /
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
    savedLessonPlans,
  };
}
