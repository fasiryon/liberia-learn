import { prisma } from "@/lib/db";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

type SessionUserLike = {
  id: string;
  schoolId?: string | null;
};

export type ProgressActivity = {
  id: string;
  type: "lesson_completed" | "quiz_submitted" | "certificate_awarded";
  title: string;
  subject: string;
  occurredAt: string;
  scorePercent?: number | null;
};

export type SubjectProgressSummary = {
  subject: string;
  label: string;
  completedLessons: number;
  totalLessons: number;
  completionPercent: number;
  latestDerivedScore: number | null;
  latestMasteryState: string | null;
};

export type StudentProgressSummary = {
  totalLessonsCompleted: number;
  totalLessonsAssigned: number;
  averageQuizScorePercent: number;
  currentStreakDays: number;
  overallCurriculumCompletionPercent: number;
  subjectProgress: SubjectProgressSummary[];
  recentActivity: ProgressActivity[];
};

function toIsoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function subjectLabel(subject: string) {
  return subject.replace(/_/g, " ");
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function buildStudentProgressSummary(
  user: SessionUserLike
): Promise<StudentProgressSummary> {
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      enrollments: {
        select: { classId: true },
      },
    },
  });

  if (!student) {
    return {
      totalLessonsCompleted: 0,
      totalLessonsAssigned: 0,
      averageQuizScorePercent: 0,
      currentStreakDays: 0,
      overallCurriculumCompletionPercent: 0,
      subjectProgress: [],
      recentActivity: [],
    };
  }

  const classIds = student.enrollments.map((enrollment) => enrollment.classId);

  const [scheduledLessons, lessonProgress, quizAttempts, derivedProgress, certificates] =
    await Promise.all([
      classIds.length > 0
        ? prisma.scheduledWork.findMany({
            where: {
              classId: { in: classIds },
              class: user.schoolId ? { schoolId: user.schoolId } : undefined,
            },
            select: {
              id: true,
              scheduledDate: true,
              content: {
                select: {
                  contentId: true,
                  subject: true,
                  payload: true,
                },
              },
            },
            orderBy: { scheduledDate: "asc" },
          })
        : Promise.resolve([]),
      prisma.studentProgress.findMany({
        where: {
          studentId: user.id,
          scheduledWork: user.schoolId
            ? { class: { schoolId: user.schoolId } }
            : undefined,
        },
        select: {
          scheduledWorkId: true,
          completedAt: true,
          startedAt: true,
          scheduledWork: {
            select: {
              content: {
                select: {
                  contentId: true,
                  subject: true,
                  payload: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.assessmentAttempt.findMany({
        where: {
          studentId: student.id,
          source: "student.lesson.quiz.submit",
        },
        select: {
          id: true,
          subject: true,
          score: true,
          attemptedAt: true,
          submittedAt: true,
          metadata: true,
        },
        orderBy: { attemptedAt: "desc" },
      }),
      prisma.derivedStudentProgress.findMany({
        where: {
          studentId: student.id,
        },
        select: {
          subject: true,
          currentScore: true,
          masteryState: true,
          derivedAt: true,
        },
        orderBy: { derivedAt: "desc" },
      }),
      prisma.certificate.findMany({
        where: { studentId: student.id },
        select: {
          id: true,
          type: true,
          referenceId: true,
          awardedAt: true,
        },
        orderBy: { awardedAt: "desc" },
        take: 10,
      }),
    ]);

  const lessonMetaByScheduledWorkId = new Map(
    scheduledLessons.map((lesson) => {
      const payload = (lesson.content.payload ?? {}) as Record<string, unknown>;
      return [
        lesson.id,
        {
          subject: lesson.content.subject,
          title: resolveLessonTitle({
            payload,
            subject: lesson.content.subject,
            fallbackTitle: lesson.content.contentId,
          }),
        },
      ] as const;
    })
  );

  const completedLessonIds = new Set(
    lessonProgress
      .filter((progress) => progress.completedAt)
      .map((progress) => progress.scheduledWorkId)
  );

  const subjectTotals = new Map<string, { total: number; completed: number }>();
  for (const lesson of scheduledLessons) {
    const current = subjectTotals.get(lesson.content.subject) ?? {
      total: 0,
      completed: 0,
    };
    current.total += 1;
    if (completedLessonIds.has(lesson.id)) {
      current.completed += 1;
    }
    subjectTotals.set(lesson.content.subject, current);
  }

  const latestDerivedBySubject = new Map<
    string,
    { currentScore: number | null; masteryState: string | null }
  >();
  for (const row of derivedProgress) {
    if (!latestDerivedBySubject.has(row.subject)) {
      latestDerivedBySubject.set(row.subject, {
        currentScore: row.currentScore ?? null,
        masteryState: row.masteryState ?? null,
      });
    }
  }

  const subjectKeys = Array.from(
    new Set([
      ...subjectTotals.keys(),
      ...latestDerivedBySubject.keys(),
    ])
  ).sort();

  const subjectProgress: SubjectProgressSummary[] = subjectKeys.map((subject) => {
    const totals = subjectTotals.get(subject) ?? { total: 0, completed: 0 };
    const derived = latestDerivedBySubject.get(subject) ?? {
      currentScore: null,
      masteryState: null,
    };

    return {
      subject,
      label: subjectLabel(subject),
      completedLessons: totals.completed,
      totalLessons: totals.total,
      completionPercent:
        totals.total > 0 ? clampPercent((totals.completed / totals.total) * 100) : 0,
      latestDerivedScore:
        typeof derived.currentScore === "number"
          ? clampPercent(derived.currentScore * 100)
          : null,
      latestMasteryState: derived.masteryState,
    };
  });

  const scoredAttempts = quizAttempts.filter(
    (attempt): attempt is typeof attempt & { score: number } =>
      typeof attempt.score === "number"
  );
  const averageQuizScorePercent =
    scoredAttempts.length > 0
      ? clampPercent(
          (scoredAttempts.reduce((sum, attempt) => sum + attempt.score, 0) /
            scoredAttempts.length) *
            100
        )
      : 0;

  const activityDays = new Set<string>();
  for (const progress of lessonProgress) {
    if (progress.completedAt) {
      activityDays.add(toIsoDay(progress.completedAt));
    }
  }
  for (const attempt of quizAttempts) {
    const occurredAt = attempt.submittedAt ?? attempt.attemptedAt;
    if (occurredAt) {
      activityDays.add(toIsoDay(occurredAt));
    }
  }

  let currentStreakDays = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  const todayKey = toIsoDay(cursor);
  if (!activityDays.has(todayKey)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  for (let index = 0; index < 365; index += 1) {
    const dayKey = toIsoDay(cursor);
    if (!activityDays.has(dayKey)) {
      break;
    }

    currentStreakDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const lessonActivities: ProgressActivity[] = lessonProgress
    .filter((progress) => progress.completedAt)
    .map((progress) => {
      const meta =
        lessonMetaByScheduledWorkId.get(progress.scheduledWorkId) ?? {
          title: "Lesson completed",
          subject: "General",
        };

      return {
        id: `lesson:${progress.scheduledWorkId}`,
        type: "lesson_completed",
        title: `Completed ${meta.title}`,
        subject: meta.subject,
        occurredAt: progress.completedAt!.toISOString(),
      };
    });

  const quizActivities: ProgressActivity[] = quizAttempts.map((attempt) => {
    const metadata =
      attempt.metadata && typeof attempt.metadata === "object"
        ? (attempt.metadata as Record<string, unknown>)
        : {};
    const scheduledWorkId =
      typeof metadata.scheduledWorkId === "string" ? metadata.scheduledWorkId : null;
    const meta =
      (scheduledWorkId && lessonMetaByScheduledWorkId.get(scheduledWorkId)) ?? null;
    const occurredAt = attempt.submittedAt ?? attempt.attemptedAt;

    return {
      id: `quiz:${attempt.id}`,
      type: "quiz_submitted",
      title: `Quiz submitted${meta ? ` for ${meta.title}` : ""}`,
      subject: attempt.subject ?? meta?.subject ?? "General",
      occurredAt: (occurredAt ?? new Date()).toISOString(),
      scorePercent:
        typeof attempt.score === "number" ? clampPercent(attempt.score * 100) : null,
    };
  });

  const certificateActivities: ProgressActivity[] = certificates.map((certificate) => ({
    id: `certificate:${certificate.id}`,
    type: "certificate_awarded",
    title:
      certificate.type === "LESSON"
        ? "Lesson certificate awarded"
        : `${subjectLabel(certificate.referenceId)} subject certificate awarded`,
    subject:
      certificate.type === "LESSON"
        ? lessonMetaByScheduledWorkId.get(certificate.referenceId)?.subject ?? "General"
        : certificate.referenceId,
    occurredAt: certificate.awardedAt.toISOString(),
  }));

  const recentActivity = [...lessonActivities, ...quizActivities, ...certificateActivities]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 10);

  const totalLessonsAssigned = scheduledLessons.length;
  const totalLessonsCompleted = completedLessonIds.size;

  return {
    totalLessonsCompleted,
    totalLessonsAssigned,
    averageQuizScorePercent,
    currentStreakDays,
    overallCurriculumCompletionPercent:
      totalLessonsAssigned > 0
        ? clampPercent((totalLessonsCompleted / totalLessonsAssigned) * 100)
        : 0,
    subjectProgress,
    recentActivity,
  };
}
