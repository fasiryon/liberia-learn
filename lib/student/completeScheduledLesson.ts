import type { Subject } from "@prisma/client";

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { checkAndAwardCertificate } from "@/lib/certificates/autoAwardCertificate";
import { resolveActionsOnLessonComplete } from "@/lib/intelligence/actionEngine";
import { notifyLessonCompletion } from "@/lib/lesson-notifications";
import { updateMasteryProfile } from "@/lib/mastery/masteryService";
import { gradeToBand } from "@/lib/moe/alignment-engine";
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

type CompleteLessonInput = {
  user: SessionUserLike;
  scheduledWorkId: string;
  exitTicketAnswers?: ExitTicketAnswer[];
};

function coerceSubject(subject: string): Subject {
  const normalized = subject.toUpperCase();
  const subjectMap: Record<string, Subject> = {
    MATH: "MATH",
    MATHEMATICS: "MATH",
    SCIENCE: "SCIENCE",
    LITERACY: "LITERACY",
    CIVICS: "CIVICS",
    COMPUTER_SCIENCE: "COMPUTER_SCIENCE",
    ENGINEERING: "ENGINEERING",
    ARTS: "ARTS",
    PE: "PE",
    CAREER: "CAREER",
  };
  return subjectMap[normalized] ?? "LITERACY";
}

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
          payload: true,
          deliveryProfile: true,
          moeAlignments: true,
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

  const now = new Date();
  const progress = await prisma.studentProgress.upsert({
    where: { studentId_scheduledWorkId: { studentId: input.user.id, scheduledWorkId: input.scheduledWorkId } },
    create: {
      studentId: input.user.id,
      scheduledWorkId: input.scheduledWorkId,
      startedAt: now,
      completedAt: now,
      exitTicketResponses: normalizedAnswers,
      exitTicketScore,
    },
    update: {
      completedAt: now,
      exitTicketResponses: normalizedAnswers,
      exitTicketScore,
    },
  });

  if (exitTicketScore != null) {
    const standardCode = exitTicketQuestions.find((question: any) => typeof question?.standardCode === "string")?.standardCode;
    const moeAlignmentCode = Array.isArray(content.moeAlignments)
      ? (content.moeAlignments as Array<{ code?: string }>).find((entry) => entry?.code)?.code
      : null;
    const strandKey = (standardCode ?? moeAlignmentCode ?? `${content.subject}`.toLowerCase()).toString().toLowerCase();
    const normalizedScore = Math.min(1, Math.max(0, exitTicketScore / 100));

    await updateMasteryProfile({
      studentId: student.id,
      schoolId: sw.class.schoolId,
      subject: coerceSubject(content.subject),
      strandKey,
      gradeBand: gradeToBand(content.grade),
      newScore: normalizedScore,
      wasAiAssisted: false,
      totalAttempts: 1,
      aiAssistedAttempts: 0,
      recentScores: [normalizedScore],
    }).catch(() => null);
  }

  await logAudit({
    userId: input.user.id,
    schoolId: sw.class.schoolId,
    action: "lesson.completed",
    resourceType: "scheduledWork",
    resourceId: input.scheduledWorkId,
    details: {
      exitTicketScore,
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
        exitTicketScore == null ? "none" : exitTicketScore >= 80 ? "high" : exitTicketScore >= 60 ? "passing" : "needs_support",
      answeredQuestions: normalizedAnswers.length,
    },
  });

  await notifyLessonCompletion({
    actingUserId: input.user.id,
    schoolId: sw.class.schoolId,
    schoolName: (sw.class as any).School?.name ?? "School",
    studentId: student.id,
    studentName: student.user?.name?.trim() || "Student",
    subject: content.subject,
  }).catch(() => null);

  resolveActionsOnLessonComplete(student.id, input.scheduledWorkId).catch(() => null);
  checkAndAwardCertificate(student.id, content.subject, content.grade, input.user.id).catch(() => {});
  void updateStreak(input.user.id).catch(() => null);

  return {
    completedAt: progress.completedAt,
    exitTicketScore,
  };
}
