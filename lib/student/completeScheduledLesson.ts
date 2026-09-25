import { recordMetricEvent } from "@/lib/metrics/events";
import { resolveMasteryStrandForLesson } from "@/lib/mastery/resolveStrand";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { checkAndAwardCertificate } from "@/lib/certificates/autoAwardCertificate";
import { resolveActionsOnLessonComplete } from "@/lib/intelligence/actionEngine";
import { notifyLessonCompletion } from "@/lib/lesson-notifications";
import { updateMasteryProfile } from "@/lib/mastery/masteryService";
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";
import { updateStreak } from "@/lib/gamification/streakService";

type SessionUserLike = {
  id: string;
  schoolId?: string | null;
};

type ExitTicketAnswer = {
  questionIndex: number;
  answer: string | number | null;
};

const PROGRESS_SELECT = {
  id: true,
  completedAt: true,
  exitTicketScore: true,
  masteryEffectAt: true,
  progressionEffectAt: true,
  streakEffectAt: true,
  guardianNotifiedAt: true,
} as const;

/** Claim-once markers on StudentProgress, one per consequential side effect. */
type CompletionEffect = "masteryEffectAt" | "progressionEffectAt" | "streakEffectAt" | "guardianNotifiedAt";

type CompleteLessonInput = {
  user: SessionUserLike;
  scheduledWorkId: string;
  exitTicketAnswers?: ExitTicketAnswer[];
};

function scoreExitTicket(questions: any[], answers: ExitTicketAnswer[]) {
  if (!Array.isArray(questions) || questions.length === 0) return null;

  let scoreableCount = 0;
  let correctCount = 0;

  for (const answer of answers) {
    const question = questions[answer.questionIndex];
    if (!question) continue;
    const correctAnswer = question.correctAnswer ?? question.answer ?? question.correctOption ?? null;
    if (correctAnswer == null) continue;
    scoreableCount += 1;
    if (String(correctAnswer) === String(answer.answer)) {
      correctCount += 1;
    }
  }

  if (scoreableCount === 0) return null;
  return Math.round((correctCount / scoreableCount) * 100);
}

export async function completeScheduledLesson(input: CompleteLessonInput) {
  const sw = await prisma.scheduledWork.findUnique({
    where: { id: input.scheduledWorkId },
    include: {
      class: {
        select: {
          id: true,
          schoolId: true,
          School: { select: { name: true } },
        },
      },
      content: {
        select: {
          grade: true,
          subject: true,
          title: true,
          payload: true,
          deliveryProfile: true,
          moeAlignments: true,
          waecSyllabusTopics: true,
        },
      },
    },
  });

  if (!sw) {
    throw Object.assign(new Error("Not found"), { status: 404 });
  }
  if (sw.class.schoolId !== input.user.schoolId) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const content = (sw as any).content ?? {
    grade: 1,
    subject: "LITERACY",
    payload: {},
    deliveryProfile: null,
    moeAlignments: [],
  };

  const student = await prisma.student.findUnique({
    where: { userId: input.user.id },
    select: {
      id: true,
      user: { select: { name: true } },
    },
  });
  if (!student) {
    throw Object.assign(new Error("Student not found"), { status: 404 });
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId: student.id, classId: sw.classId } },
  });
  if (!enrollment) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }

  const payload = (content.payload ?? {}) as any;
  const deliveryProfile = (content.deliveryProfile ?? payload.deliveryProfile ?? {}) as any;
  const exitTicketQuestions = Array.isArray(deliveryProfile?.exitTicket?.questions)
    ? deliveryProfile.exitTicket.questions
    : [];
  const normalizedAnswers = Array.isArray(input.exitTicketAnswers)
    ? input.exitTicketAnswers.map((answer) => ({
        questionIndex: Number(answer.questionIndex),
        answer: answer.answer ?? null,
      }))
    : [];
  const exitTicketScore = scoreExitTicket(exitTicketQuestions, normalizedAnswers);

  // Exactly-once completion. The StudentProgress row for (learner, lesson) is
  // the stable completion identity. The first request to flip completedAt from
  // null wins with a conditional UPDATE (row-locked in Postgres, so concurrent
  // double-taps cannot both win); every later request - identical replay,
  // retry after a lost response, resubmission with other answers - gets the
  // canonical first completion back.
  const progressKey = { studentId: input.user.id, scheduledWorkId: input.scheduledWorkId };
  const loadProgress = () =>
    prisma.studentProgress.findUnique({
      where: { studentId_scheduledWorkId: progressKey },
      select: PROGRESS_SELECT,
    });

  let progress = await loadProgress();
  let firstCompletion = false;
  if (!progress?.completedAt) {
    const now = new Date();
    await prisma.studentProgress.createMany({ data: [{ ...progressKey, startedAt: now }], skipDuplicates: true });
    const claimed = await prisma.studentProgress.updateMany({
      where: { ...progressKey, completedAt: null },
      data: { completedAt: now, exitTicketResponses: normalizedAnswers, exitTicketScore },
    });
    firstCompletion = claimed.count === 1;
    progress = await loadProgress();
  }
  if (!progress?.completedAt) {
    throw Object.assign(new Error("Lesson completion could not be recorded"), { status: 500 });
  }
  const canonical = progress;

  if (firstCompletion) {
    await logAudit({
      userId: input.user.id,
      schoolId: sw.class.schoolId,
      action: "lesson.completed",
      resourceType: "scheduledWork",
      resourceId: input.scheduledWorkId,
      details: {
        exitTicketScore: canonical.exitTicketScore,
        answeredQuestions: normalizedAnswers.length,
      },
    });

    await logProductSignal({
      schoolId: sw.class.schoolId,
      classId: sw.class.id,
      userId: input.user.id,
      studentId: student.id,
      actor: { type: "student", id: input.user.id, role: "STUDENT" },
      target: { type: "scheduledWork", id: input.scheduledWorkId },
      eventType: "lesson.completed",
      source: "lib/student/completeScheduledLesson",
      contentId: sw.contentId ?? null,
      lessonId: input.scheduledWorkId,
      subject: content.subject,
      grade: content.grade,
      dedupeKey: `lesson.completed:${sw.class.schoolId}:${student.id}:${input.scheduledWorkId}`,
      metadata: {
        exitTicketScoreBand:
          canonical.exitTicketScore == null
            ? "none"
            : canonical.exitTicketScore >= 80
              ? "high"
              : canonical.exitTicketScore >= 60
                ? "passing"
                : "needs_support",
        answeredQuestions: normalizedAnswers.length,
      },
    });
  }

  // Each consequential effect is claimed (null -> timestamp) immediately before
  // it runs, so it happens at most once per completion. An effect that was
  // never claimed (the process stopped right after the completion write) is
  // picked up by the next replay, which makes a retry after a crash safe.
  // Effects use the canonical stored score, never a replayed request body.
  const claim = async (effect: CompletionEffect) => {
    if (canonical[effect]) return false;
    const result = await prisma.studentProgress.updateMany({
      where: { id: canonical.id, [effect]: null },
      data: { [effect]: new Date() },
    });
    return result.count === 1;
  };

  if (await claim("masteryEffectAt")) {
    await recordMasteryEvidence({
      exitTicketScore: canonical.exitTicketScore,
      exitTicketQuestions,
      content,
      payload,
      studentId: student.id,
      schoolId: sw.class.schoolId,
    });
  }

  if (await claim("guardianNotifiedAt")) {
    await notifyLessonCompletion({
      actingUserId: input.user.id,
      schoolId: sw.class.schoolId,
      schoolName: (sw.class as any).School?.name ?? "School",
      studentId: student.id,
      studentName: student.user?.name?.trim() || "Student",
      subject: content.subject,
    }).catch(() => null);
  }

  if (await claim("progressionEffectAt")) {
    resolveActionsOnLessonComplete(student.id, input.scheduledWorkId).catch(() => null);
    checkAndAwardCertificate(student.id, content.subject, content.grade, input.user.id).catch(() => {});
  }

  if (await claim("streakEffectAt")) {
    void updateStreak(input.user.id).catch(() => null);
  }

  return {
    completedAt: canonical.completedAt,
    exitTicketScore: canonical.exitTicketScore,
    replayed: !firstCompletion,
  };
}

async function recordMasteryEvidence(input: {
  exitTicketScore: number | null;
  exitTicketQuestions: any[];
  content: any;
  payload: any;
  studentId: string;
  schoolId: string;
}) {
  const { exitTicketScore, exitTicketQuestions, content, payload } = input;
  if (exitTicketScore == null) return;
  const standardCode = exitTicketQuestions.find((question: any) => typeof question?.standardCode === "string")?.standardCode;
  const moeAlignmentCode = Array.isArray(content.moeAlignments)
    ? (content.moeAlignments as Array<{ code?: string }>).find((entry) => entry?.code)?.code
    : null;
  const normalizedScore = Math.min(1, Math.max(0, exitTicketScore / 100));
  const telemetryScope = { scope: "school" as const, scopeId: input.schoolId, schoolId: input.schoolId };

  // Phase 5A: resolve a StrandCatalog-valid target BEFORE writing so the mastery FK
  // never mismatches (the root cause the old silent .catch(() => null) hid).
  const strand = await resolveMasteryStrandForLesson({
    contentSubject: `${content.subject}`,
    grade: content.grade,
    title: content.title ?? null,
    text: typeof payload?.title === "string" ? payload.title : null,
    waecTopics: content.waecSyllabusTopics ?? [],
    standardCode: standardCode ?? null,
    moeAlignmentCode: moeAlignmentCode ?? null,
  }).catch(() => null);

  if (strand) {
    await updateMasteryProfile({
      studentId: input.studentId,
      schoolId: input.schoolId,
      subject: strand.subject,
      strandKey: strand.strandKey,
      gradeBand: strand.gradeBand,
      newScore: normalizedScore,
      wasAiAssisted: false,
      totalAttempts: 1,
      aiAssistedAttempts: 0,
      recentScores: [normalizedScore],
    }).catch((err) => {
      // Surface residual write failures instead of silently swallowing them.
      recordMetricEvent(
        "mastery.write_failed",
        { subject: strand.subject, strandKey: strand.strandKey, reason: err instanceof Error ? err.message : String(err) },
        { ...telemetryScope, severity: "warning" }
      ).catch(() => {});
    });
  } else {
    recordMetricEvent(
      "mastery.strand_unresolved",
      { subject: `${content.subject}`, grade: content.grade },
      { ...telemetryScope, severity: "warning" }
    ).catch(() => {});
  }
}
