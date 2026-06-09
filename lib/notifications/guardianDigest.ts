import { prisma } from "@/lib/db";
import { renderGuardianTemplate } from "@/lib/guardian/sms-templates";

export type DigestInput = {
  guardianId: string;
  studentIds: string[];
  weekStart: Date;
  weekEnd: Date;
};

export type DigestMetrics = {
  lessonsCompleted: number;
  avgScore: number;
  strongestSubject: string | null;
  stuckLessonTitle: string | null;
  actionTip: string | null;
};

export type DigestResult = {
  schoolId: string;
  primaryStudentId: string;
  studentFirstName: string;
  smsText: string;
  metrics: DigestMetrics;
};

export async function composeGuardianDigest(input: DigestInput): Promise<DigestResult | null> {
  const { guardianId, studentIds, weekStart, weekEnd } = input;
  if (!studentIds.length) return null;

  // Check opt-out: guardian must have at least one active consent
  const guardian = await prisma.user.findUnique({
    where: { id: guardianId },
    select: {
      smsOptIn: true,
      preferredChannel: true,
      guardianSmsPreferences: true,
      guardianOf: {
        where: { studentId: { in: studentIds } },
        select: {
          studentId: true,
          student: { select: { userId: true, user: { select: { name: true, schoolId: true } } } },
        },
      },
    },
  });

  if (!guardian) return null;

  // Check guardian-level opt-in
  if (!guardian.smsOptIn || !["SMS", "BOTH"].includes(guardian.preferredChannel)) return null;

  // Check weeklyDigest preference (defaults to true)
  const prefs = guardian.guardianSmsPreferences as Record<string, unknown> | null;
  if (prefs && prefs.weeklyDigest === false) return null;

  // Check per-student consent opt-out
  const consents = await prisma.guardianConsent.findMany({
    where: { guardianId, studentId: { in: studentIds } },
    select: { optedOutAt: true, studentId: true },
  });
  const optedOutIds = new Set(consents.filter((c) => c.optedOutAt).map((c) => c.studentId));
  const activeStudentIds = studentIds.filter((id) => !optedOutIds.has(id));
  if (!activeStudentIds.length) return null;

  const linkedStudents = guardian.guardianOf.filter((sg) =>
    activeStudentIds.includes(sg.studentId)
  );
  if (!linkedStudents.length) return null;

  const primaryStudent = linkedStudents[0];
  const schoolId = primaryStudent.student.user.schoolId ?? "";
  const studentFirstName = primaryStudent.student.user.name?.split(" ")[0] ?? "your child";

  // --- Aggregate lesson progress for the week ---
  // StudentProgress.studentId stores User.id (see completeScheduledLesson),
  // while activeStudentIds are Student.id values — map through the linked
  // student records. Querying with Student.id here silently matched nothing.
  const activeUserIds = linkedStudents.map((sg) => sg.student.userId);
  const progress = await prisma.studentProgress.findMany({
    where: {
      studentId: { in: activeUserIds },
      startedAt: { gte: weekStart, lte: weekEnd },
    },
    select: {
      studentId: true,
      scheduledWork: {
        select: { id: true, content: { select: { subject: true, title: true } } },
      },
    },
  });

  const lessonsCompleted = progress.length;
  if (!lessonsCompleted) return null;

  // --- Scores ---
  const [hwSubmissions, gradedSubmissions] = await Promise.all([
    prisma.homeworkSubmission.findMany({
      where: {
        studentId: { in: activeStudentIds },
        submittedAt: { gte: weekStart, lte: weekEnd },
        aiScore: { not: null },
      },
      select: { aiScore: true },
    }),
    prisma.gradedSubmission.findMany({
      where: {
        studentId: { in: activeStudentIds },
        createdAt: { gte: weekStart, lte: weekEnd },
        score: { not: null },
      },
      select: { score: true },
    }),
  ]);

  const allScores = [
    ...hwSubmissions.map((h) => h.aiScore! * 100),
    ...gradedSubmissions.map((g) => g.score! * 100),
  ];
  const avgScore = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  // --- Strongest subject ---
  const subjectCounts = new Map<string, number>();
  for (const p of progress) {
    const subj = p.scheduledWork?.content?.subject ?? "GENERAL";
    subjectCounts.set(subj, (subjectCounts.get(subj) ?? 0) + 1);
  }
  const strongestSubject = subjectCounts.size
    ? [...subjectCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // --- Action tip from StuckEvents (specific lesson, not generic) ---
  const stuckEvents = await prisma.stuckEvent.findMany({
    where: { studentId: { in: activeStudentIds }, createdAt: { gte: weekStart, lte: weekEnd } },
    select: { lessonId: true, signal: true },
  });

  let actionTip: string | null = null;
  let stuckLessonTitle: string | null = null;

  if (stuckEvents.length) {
    const stuckCounts = new Map<string, number>();
    for (const e of stuckEvents) {
      stuckCounts.set(e.lessonId, (stuckCounts.get(e.lessonId) ?? 0) + 1);
    }
    const topLessonId = [...stuckCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const sw = await prisma.scheduledWork.findUnique({
      where: { id: topLessonId },
      select: { content: { select: { title: true, subject: true } } },
    });

    if (sw?.content?.title) {
      // Truncate to fit within overall 160-char SMS budget
      const rawTitle = sw.content.title.slice(0, 45);
      stuckLessonTitle = rawTitle;
      actionTip = `Try: review "${rawTitle}" this weekend.`;
    }
  }

  // Fallback tip: reference weakest subject if no stuck data
  if (!actionTip && strongestSubject) {
    const allSubjects = [...subjectCounts.keys()];
    const weakestSubject =
      allSubjects.length > 1
        ? [...subjectCounts.entries()].sort((a, b) => a[1] - b[1])[0][0]
        : null;

    if (weakestSubject && weakestSubject !== strongestSubject) {
      const lessonTitle = progress
        .find((p) => p.scheduledWork?.content?.subject === weakestSubject)
        ?.scheduledWork?.content?.title?.slice(0, 45);
      if (lessonTitle) {
        actionTip = `Practice ${weakestSubject.toLowerCase()} — "${lessonTitle}" this weekend.`;
      }
    }
  }

  const smsText = renderGuardianTemplate("weekly_digest", {
    studentName: studentFirstName,
    lessonsCompleted: String(lessonsCompleted),
    avgScore: String(avgScore),
    actionTip: actionTip ?? undefined,
  });

  return {
    schoolId,
    primaryStudentId: primaryStudent.studentId,
    studentFirstName,
    smsText,
    metrics: { lessonsCompleted, avgScore, strongestSubject, stuckLessonTitle, actionTip },
  };
}

/** Build week boundaries for the most recent school week (Mon–Fri) ending before `anchor`. */
export function mostRecentWeekWindow(anchor: Date): { weekStart: Date; weekEnd: Date } {
  // Find the most recent Friday at or before anchor.
  // daysBack formula: (dow + 2) % 7 gives exact days to subtract to land on Friday.
  // Fri=0, Sat=1, Sun=2, Mon=3, Tue=4, Wed=5, Thu=6.
  const d = new Date(anchor);
  d.setUTCHours(23, 59, 59, 999);
  const dow = d.getUTCDay(); // 0=Sun ... 6=Sat
  const daysBack = (dow + 2) % 7; // days to go back to reach most recent Friday
  d.setUTCDate(d.getUTCDate() - daysBack);
  const weekEnd = new Date(d);

  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekEnd.getUTCDate() - 4); // Mon = Fri - 4
  weekStart.setUTCHours(0, 0, 0, 0);

  return { weekStart, weekEnd };
}
