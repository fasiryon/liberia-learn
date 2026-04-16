import { prisma } from "@/lib/db";

type JsonRecord = Record<string, unknown>;

export type TeacherLessonQuizPerformance = {
  lessonKey: string;
  lessonTitle: string;
  averageQuizScore: number;
  attemptCount: number;
};

export type TeacherStudentQuizStanding = {
  studentId: string;
  userId: string;
  name: string;
  averageQuizScore: number;
  attemptCount: number;
  profileHref: string;
};

export type TeacherAtRiskStudent = {
  studentId: string;
  userId: string;
  name: string;
  classId: string;
  className: string;
  lastActivityAt: string | null;
  daysSinceActivity: number;
  profileHref: string;
};

export type TeacherClassPerformance = {
  classId: string;
  className: string;
  subject: string;
  studentCount: number;
  lessonCount: number;
  lessonCompletionRate: number;
  averageQuizScore: number | null;
  lessonQuizPerformance: TeacherLessonQuizPerformance[];
  strugglingLesson: TeacherLessonQuizPerformance | null;
  topStudents: TeacherStudentQuizStanding[];
  bottomStudents: TeacherStudentQuizStanding[];
  atRiskStudents: TeacherAtRiskStudent[];
};

type TeacherAssessmentAttempt = {
  classId: string | null;
  studentId: string | null;
  score: number | null;
  attemptedAt: Date;
  metadata: JsonRecord | null;
};

type TeacherEnrollmentRow = {
  classId: string;
  Student: {
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string;
    };
  };
};

function roundPercent(value: number): number {
  return Math.round(value * 100);
}

function toPercentAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100);
}

function dayDiffFromNow(value: Date): number {
  return Math.floor((Date.now() - value.getTime()) / 86_400_000);
}

function getAttemptLessonKeys(metadata: JsonRecord | null) {
  const contentId =
    typeof metadata?.contentId === "string" ? metadata.contentId : null;
  const scheduledWorkId =
    typeof metadata?.scheduledWorkId === "string" ? metadata.scheduledWorkId : null;

  return {
    contentId,
    scheduledWorkId,
    lessonKey: contentId ?? scheduledWorkId ?? "unknown-lesson",
  };
}

export async function buildTeacherClassPerformance(
  teacherId: string,
  schoolId: string
): Promise<TeacherClassPerformance[]> {
  const classes = await prisma.class.findMany({
    where: {
      schoolId,
      teacherId,
    },
    select: {
      id: true,
      name: true,
      subject: true,
    },
    orderBy: [{ name: "asc" }],
  });

  if (classes.length === 0) {
    return [];
  }

  const classIds = classes.map((row) => row.id);

  const [enrollmentsResult, scheduledWorkResult, attemptsResult] = await Promise.all([
    prisma.enrollment.findMany({
      where: { classId: { in: classIds } },
      select: {
        classId: true,
        Student: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.scheduledWork.findMany({
      where: { classId: { in: classIds } },
      select: {
        id: true,
        classId: true,
        contentId: true,
        content: {
          select: {
            contentId: true,
            payload: true,
          },
        },
      },
    }),
    (prisma as typeof prisma & {
      assessmentAttempt?: { findMany?: (args: unknown) => Promise<TeacherAssessmentAttempt[] | undefined> };
    }).assessmentAttempt?.findMany?.({
      where: {
        schoolId,
        classId: { in: classIds },
        source: "student.lesson.quiz.submit",
      },
      select: {
        classId: true,
        studentId: true,
        score: true,
        attemptedAt: true,
        metadata: true,
      },
      orderBy: [{ attemptedAt: "desc" }],
    }) ?? Promise.resolve([]),
  ]);
  const enrollments = enrollmentsResult ?? [];
  const scheduledWork = scheduledWorkResult ?? [];
  const attempts = attemptsResult ?? [];

  const contentIdsFromAttempts = new Set<string>();
  for (const attempt of attempts as TeacherAssessmentAttempt[]) {
    const contentId = typeof attempt.metadata?.contentId === "string" ? attempt.metadata.contentId : null;
    if (contentId) {
      contentIdsFromAttempts.add(contentId);
    }
  }

  const missingContentIds = [...contentIdsFromAttempts].filter(
    (contentId) => !scheduledWork.some((row) => row.contentId === contentId)
  );

  const curriculumFallback =
    missingContentIds.length > 0
      ? await prisma.curriculumContent.findMany({
          where: { contentId: { in: missingContentIds } },
          select: { contentId: true, payload: true },
        })
      : [];

  const lessonTitleByKey = new Map<string, string>();
  for (const row of scheduledWork) {
    const title =
      ((row.content?.payload as JsonRecord | null)?.title as string | undefined) ??
      row.contentId ??
      "Lesson";
    if (row.contentId) {
      lessonTitleByKey.set(row.contentId, title);
    }
    lessonTitleByKey.set(row.id, title);
  }
  for (const row of curriculumFallback) {
    const title =
      ((row.payload as JsonRecord | null)?.title as string | undefined) ??
      row.contentId;
    lessonTitleByKey.set(row.contentId, title);
  }

  const progress =
    scheduledWork.length > 0
      ? ((await (prisma as typeof prisma & {
          studentProgress?: {
            findMany?: (args: unknown) => Promise<
              Array<{
                studentId: string;
                scheduledWorkId: string;
                startedAt: Date | null;
                completedAt: Date | null;
              }>
            > | undefined;
          };
        }).studentProgress?.findMany?.({
          where: {
            scheduledWorkId: { in: scheduledWork.map((row) => row.id) },
          },
          select: {
            studentId: true,
            scheduledWorkId: true,
            startedAt: true,
            completedAt: true,
          },
        })) ?? [])
      : [];

  const enrollmentsByClass = new Map<string, TeacherEnrollmentRow[]>();
  for (const row of enrollments as TeacherEnrollmentRow[]) {
    const existing = enrollmentsByClass.get(row.classId) ?? [];
    existing.push(row);
    enrollmentsByClass.set(row.classId, existing);
  }

  const scheduledWorkByClass = new Map<string, typeof scheduledWork>();
  for (const row of scheduledWork) {
    const existing = scheduledWorkByClass.get(row.classId) ?? [];
    existing.push(row);
    scheduledWorkByClass.set(row.classId, existing);
  }

  const completionsByWorkId = new Map<string, number>();
  const latestActivityByUserId = new Map<string, Date>();
  for (const row of progress) {
    if (row.completedAt) {
      completionsByWorkId.set(
        row.scheduledWorkId,
        (completionsByWorkId.get(row.scheduledWorkId) ?? 0) + 1
      );
    }

    const latestActivity = row.completedAt ?? row.startedAt;
    if (latestActivity) {
      const existing = latestActivityByUserId.get(row.studentId);
      if (!existing || latestActivity > existing) {
        latestActivityByUserId.set(row.studentId, latestActivity);
      }
    }
  }

  const latestActivityByStudentId = new Map<string, Date>();
  for (const attempt of attempts as TeacherAssessmentAttempt[]) {
    if (attempt.studentId) {
      const existing = latestActivityByStudentId.get(attempt.studentId);
      if (!existing || attempt.attemptedAt > existing) {
        latestActivityByStudentId.set(attempt.studentId, attempt.attemptedAt);
      }
    }
  }

  const attemptsByClass = new Map<string, TeacherAssessmentAttempt[]>();
  for (const attempt of attempts as TeacherAssessmentAttempt[]) {
    if (!attempt.classId) {
      continue;
    }
    const existing = attemptsByClass.get(attempt.classId) ?? [];
    existing.push(attempt);
    attemptsByClass.set(attempt.classId, existing);
  }

  return classes.map((cls) => {
    const classEnrollments = enrollmentsByClass.get(cls.id) ?? [];
    const classScheduledWork = scheduledWorkByClass.get(cls.id) ?? [];
    const classAttempts = attemptsByClass.get(cls.id) ?? [];
    const studentCount = classEnrollments.length;

    const expectedCompletions = classScheduledWork.length * studentCount;
    const actualCompletions = classScheduledWork.reduce(
      (sum, row) => sum + (completionsByWorkId.get(row.id) ?? 0),
      0
    );
    const lessonCompletionRate =
      expectedCompletions > 0 ? roundPercent(actualCompletions / expectedCompletions) : 0;

    const lessonBuckets = new Map<
      string,
      { title: string; scores: number[] }
    >();
    const studentBuckets = new Map<
      string,
      { userId: string; name: string; scores: number[] }
    >();

    for (const attempt of classAttempts) {
      if (typeof attempt.score !== "number" || !attempt.studentId) {
        continue;
      }

      const refs = getAttemptLessonKeys(attempt.metadata);
      const lessonTitle = lessonTitleByKey.get(refs.lessonKey) ?? "Lesson quiz";
      const lessonEntry = lessonBuckets.get(refs.lessonKey) ?? {
        title: lessonTitle,
        scores: [],
      };
      lessonEntry.scores.push(attempt.score);
      lessonBuckets.set(refs.lessonKey, lessonEntry);

      const enrollment = classEnrollments.find((row) => row.Student.id === attempt.studentId);
      if (!enrollment) {
        continue;
      }

      const studentEntry = studentBuckets.get(attempt.studentId) ?? {
        userId: enrollment.Student.user.id,
        name: enrollment.Student.user.name ?? enrollment.Student.user.email ?? "Student",
        scores: [],
      };
      studentEntry.scores.push(attempt.score);
      studentBuckets.set(attempt.studentId, studentEntry);
    }

    const lessonQuizPerformance = [...lessonBuckets.entries()]
      .map(([lessonKey, entry]) => ({
        lessonKey,
        lessonTitle: entry.title,
        averageQuizScore: toPercentAverage(entry.scores) ?? 0,
        attemptCount: entry.scores.length,
      }))
      .sort((a, b) => a.averageQuizScore - b.averageQuizScore);

    const standingRows = [...studentBuckets.entries()]
      .map(([studentId, entry]) => ({
        studentId,
        userId: entry.userId,
        name: entry.name,
        averageQuizScore: toPercentAverage(entry.scores) ?? 0,
        attemptCount: entry.scores.length,
        profileHref: `/teacher/students/${studentId}`,
      }))
      .sort((a, b) => b.averageQuizScore - a.averageQuizScore);

    const atRiskStudents = classEnrollments
      .map((row) => {
        const lessonActivity = latestActivityByUserId.get(row.Student.user.id);
        const quizActivity = latestActivityByStudentId.get(row.Student.id);
        const latestActivity =
          lessonActivity && quizActivity
            ? lessonActivity > quizActivity
              ? lessonActivity
              : quizActivity
            : lessonActivity ?? quizActivity ?? null;

        if (!latestActivity) {
          return {
            studentId: row.Student.id,
            userId: row.Student.user.id,
            name: row.Student.user.name ?? row.Student.user.email ?? "Student",
            classId: cls.id,
            className: cls.name,
            lastActivityAt: null,
            daysSinceActivity: 999,
            profileHref: `/teacher/students/${row.Student.id}`,
          };
        }

        return {
          studentId: row.Student.id,
          userId: row.Student.user.id,
          name: row.Student.user.name ?? row.Student.user.email ?? "Student",
          classId: cls.id,
          className: cls.name,
          lastActivityAt: latestActivity.toISOString(),
          daysSinceActivity: dayDiffFromNow(latestActivity),
          profileHref: `/teacher/students/${row.Student.id}`,
        };
      })
      .filter((row) => row.daysSinceActivity >= 7)
      .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

    return {
      classId: cls.id,
      className: cls.name,
      subject: String(cls.subject),
      studentCount,
      lessonCount: classScheduledWork.length,
      lessonCompletionRate,
      averageQuizScore: toPercentAverage(
        classAttempts
          .map((row) => row.score)
          .filter((score): score is number => typeof score === "number")
      ),
      lessonQuizPerformance,
      strugglingLesson: lessonQuizPerformance[0] ?? null,
      topStudents: standingRows.slice(0, 3),
      bottomStudents: [...standingRows].reverse().slice(0, 3),
      atRiskStudents,
    } satisfies TeacherClassPerformance;
  });
}
