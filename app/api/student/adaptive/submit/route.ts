import { NextRequest, NextResponse } from "next/server";
import type { Subject } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { detectMasteryGaps } from "@/lib/adaptive/gapDetector";
import {
  computeDifficultyTier,
  type AttemptRecord,
} from "@/lib/adaptive/difficultyAdapter";
import { isAdaptiveEngineEnabled } from "@/lib/serverFlags";
import { recordPerformanceEvent } from "@/lib/intelligence/recordPerformanceEvent";
import {
  appendDerivedStudentProgress,
  appendMasterySnapshot,
} from "@/lib/intelligence/derivedProgress";
import { tagMisconception } from "@/lib/intelligence/misconceptions";
import { updateMasteryProfile } from "@/lib/mastery/masteryService";
import { gradeToBand } from "@/lib/moe/alignment-engine";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type SubmitBody = {
  strandCode?: string;
  practiceSetId?: string;
  answers?: number[];
  correctAnswers?: number[];
  durationSeconds?: number;
  aiAssistUsed?: boolean;
  attempts?: number;
};

function computeScore(answers: number[], correctAnswers: number[]): number {
  if (answers.length === 0 || answers.length !== correctAnswers.length) {
    throw Object.assign(new Error("Invalid adaptive attempt payload"), { status: 400 });
  }

  const correct = answers.reduce((count, answer, index) => {
    return count + (answer === correctAnswers[index] ? 1 : 0);
  }, 0);

  return Math.round((correct / answers.length) * 10000) / 10000;
}

function findIncorrectAnswerIndices(answers: number[], correctAnswers: number[]): number[] {
  return answers.reduce<number[]>((indices, answer, index) => {
    if (answer !== correctAnswers[index]) {
      indices.push(index);
    }
    return indices;
  }, []);
}

async function resolveAttemptContext(studentId: string, strandCode: string, defaultGrade: number) {
  const gaps = await detectMasteryGaps(studentId);
  const gap = gaps.find((entry) => entry.strand === strandCode);
  if (gap) {
    return gap;
  }

  const profile = await prisma.studentMasteryProfile.findFirst({
    where: { studentId, strandKey: strandCode },
    orderBy: { lastAssessedAt: "desc" },
    select: {
      subject: true,
      strandKey: true,
      currentScore: true,
      lastAssessedAt: true,
    },
  });
  if (profile?.lastAssessedAt) {
    return {
      strand: profile.strandKey,
      subject: String(profile.subject),
      grade: defaultGrade,
      averageScore: profile.currentScore,
      attemptCount: 1,
      lastAttemptAt: profile.lastAssessedAt,
    };
  }

  const recentAttempt = await (prisma as any).studentAdaptiveAttempt.findFirst({
    where: { studentId, strandCode },
    orderBy: { completedAt: "desc" },
  });
  if (recentAttempt) {
    return {
      strand: recentAttempt.strandCode,
      subject: recentAttempt.subject,
      grade: recentAttempt.grade,
      averageScore: recentAttempt.score,
      attemptCount: 1,
      lastAttemptAt: recentAttempt.completedAt,
    };
  }

  const strand = await prisma.strandCatalog.findFirst({
    where: { strandKey: strandCode },
    select: { subject: true, strandKey: true },
  });
  if (!strand) {
    throw Object.assign(new Error("gap_not_found"), { status: 404 });
  }

  return {
    strand: strand.strandKey,
    subject: String(strand.subject),
    grade: defaultGrade,
    averageScore: 0,
    attemptCount: 0,
    lastAttemptAt: new Date(),
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!isAdaptiveEngineEnabled()) {
      return NextResponse.json({ error: "adaptive_engine_disabled" }, { status: 404 });
    }

    const user = await requireRole("STUDENT");
    const student = await prisma.student.findFirst({
      where: {
        userId: user.id,
        user: { schoolId: user.schoolId ?? null },
      },
      select: { id: true, currentGrade: true },
    });

    if (!student) {
      return NextResponse.json({ error: "student_not_found" }, { status: 404 });
    }

    const body = (await req.json()) as SubmitBody;
    if (
      typeof body?.strandCode !== "string" ||
      typeof body?.practiceSetId !== "string" ||
      !Array.isArray(body?.answers) ||
      !Array.isArray(body?.correctAnswers)
    ) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const score = computeScore(body.answers, body.correctAnswers);
    const incorrectAnswerIndices = findIncorrectAnswerIndices(body.answers, body.correctAnswers);
    const context = await resolveAttemptContext(student.id, body.strandCode, student.currentGrade ?? 0);

    const recentAttemptsBeforeWrite = await (prisma as any).studentAdaptiveAttempt.findMany({
      where: { studentId: student.id, strandCode: body.strandCode },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { score: true, completedAt: true },
    });

    const difficultyTier = computeDifficultyTier(context, recentAttemptsBeforeWrite as AttemptRecord[]);

    await (prisma as any).studentAdaptiveAttempt.create({
      data: {
        studentId: student.id,
        strandCode: context.strand,
        subject: context.subject,
        grade: context.grade,
        score,
        difficultyTier,
      },
    });

    const assessmentAttempt = await prisma.assessmentAttempt.create({
      data: {
        assessmentId: body.practiceSetId,
        studentId: student.id,
        userId: user.id,
        schoolId: user.schoolId ?? null,
        subject: context.subject,
        grade: context.grade,
        attemptNumber: Math.max(1, Number(body.attempts ?? 1)),
        status: "completed",
        score,
        maxScore: 1,
        aiAssisted: body.aiAssistUsed === true,
        rawResponse: {
          answers: body.answers,
        },
        evaluation: {
          correctAnswers: body.correctAnswers,
          incorrectAnswerIndices,
          correctCount: body.answers.length - incorrectAnswerIndices.length,
          totalQuestions: body.answers.length,
          passed: score >= 0.7,
          difficultyTier,
        },
        metadata: {
          strandCode: context.strand,
          practiceSetId: body.practiceSetId,
        },
        source: "student.adaptive.submit",
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    const recentAttempts = await (prisma as any).studentAdaptiveAttempt.findMany({
      where: { studentId: student.id, strandCode: context.strand },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { score: true, completedAt: true },
    });

    try {
      const mastery = await updateMasteryProfile({
        studentId: student.id,
        schoolId: user.schoolId!,
        subject: context.subject as Subject,
        strandKey: context.strand,
        gradeBand: gradeToBand(context.grade || 1),
        newScore: score,
        wasAiAssisted: false,
        totalAttempts: recentAttempts.length,
        aiAssistedAttempts: 0,
        recentScores: recentAttempts
          .slice()
          .reverse()
          .map((attempt: { score: number }) => attempt.score),
      });

      if (mastery?.profileId) {
        const baselineScore = mastery.currentScore - mastery.growthDelta;

        const snapshot = await appendMasterySnapshot({
          studentId: student.id,
          schoolId: user.schoolId ?? null,
          subject: String(context.subject),
          strandKey: context.strand,
          sourceProfileId: mastery.profileId,
          sourceAttemptId: assessmentAttempt.id,
          snapshotType: "adaptive_attempt",
          currentScore: mastery.currentScore,
          baselineScore,
          proficiencyState: mastery.proficiencyState,
          masteryState: mastery.masteryState,
          sustainabilityIndex: mastery.sustainabilityIndex,
          decayRate: mastery.decayRate,
          aiRelianceRate: mastery.aiRelianceRate,
          hybridScore: mastery.hybridScore,
          growthDelta: mastery.growthDelta,
          metadata: {
            difficultyTier,
            incorrectAnswerCount: incorrectAnswerIndices.length,
          },
        });

        await appendDerivedStudentProgress({
          studentId: student.id,
          schoolId: user.schoolId ?? null,
          subject: String(context.subject),
          strandKey: context.strand,
          sourceProfileId: mastery.profileId,
          sourceAttemptId: assessmentAttempt.id,
          sourceSnapshotId: snapshot.id,
          derivationType: "adaptive_attempt",
          progressVersion: "sprint3",
          currentScore: mastery.currentScore,
          baselineScore,
          growthDelta: mastery.growthDelta,
          hybridScore: mastery.hybridScore,
          sustainabilityIndex: mastery.sustainabilityIndex,
          decayRate: mastery.decayRate,
          aiRelianceRate: mastery.aiRelianceRate,
          proficiencyState: mastery.proficiencyState,
          masteryState: mastery.masteryState,
          metadata: {
            practiceSetId: body.practiceSetId,
            difficultyTier,
          },
        });
      }

      if (incorrectAnswerIndices.length > 0) {
        await tagMisconception({
          studentId: student.id,
          schoolId: user.schoolId ?? null,
          subject: String(context.subject),
          strandKey: context.strand,
          assessmentAttemptId: assessmentAttempt.id,
          taggedByUserId: user.id,
          categoryCode: "adaptive_incorrect_response",
          categoryLabel: "Adaptive Incorrect Response",
          categoryDescription: "Incorrect response pattern captured from adaptive practice.",
          confidence: incorrectAnswerIndices.length / Math.max(body.answers.length, 1),
          evidence: {
            incorrectAnswerIndices,
            totalQuestions: body.answers.length,
            difficultyTier,
            practiceSetId: body.practiceSetId,
          },
          createCategoryIfMissing: true,
        });
      }
    } catch (error) {
      logger.error("[adaptive.submit.masteryRefresh]", { error });
      throw error;
    }

    const averageScore =
      recentAttempts.reduce((sum: number, attempt: { score: number }) => sum + attempt.score, 0) /
      Math.max(recentAttempts.length, 1);
    const nextTier = computeDifficultyTier(
      {
        ...context,
        averageScore,
        attemptCount: recentAttempts.length,
        lastAttemptAt: recentAttempts[0]?.completedAt ?? new Date(),
      },
      recentAttempts as AttemptRecord[]
    );

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "student.adaptive.attempt.submitted",
      resourceType: "adaptive_attempt",
      resourceId: body.practiceSetId,
      details: {
        strandCode: context.strand,
        score,
        passed: score >= 0.7,
        nextTier,
      },
    });

    void recordPerformanceEvent({
      studentId: student.id,
      schoolId: user.schoolId!,
      subject: context.subject,
      gradeLevel: context.grade,
      eventType: "practice_attempt",
      score,
      durationSeconds: Math.max(0, Number(body.durationSeconds ?? 0)),
      attempts: Math.max(1, Number(body.attempts ?? recentAttempts.length)),
      aiAssistUsed: body.aiAssistUsed === true,
      lessonId: body.practiceSetId,
    }).catch((error) => {
      logger.warn("[adaptive.submit.performanceEvent]", { error });
    });

    return NextResponse.json({
      score,
      passed: score >= 0.7,
      nextTier,
    });
  } catch (error: any) {
    logger.error("[adaptive.submit.POST]", {
      route: "/api/student/adaptive/submit",
      error,
      status: error?.status ?? 500,
    });
    return NextResponse.json(
      { error: error?.message ?? "Server error" },
      { status: error?.status ?? 500 }
    );
  }
}
