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
import { updateMasteryProfile } from "@/lib/mastery/masteryService";
import { gradeToBand } from "@/lib/moe/alignment-engine";

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

    const recentAttempts = await (prisma as any).studentAdaptiveAttempt.findMany({
      where: { studentId: student.id, strandCode: context.strand },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { score: true, completedAt: true },
    });

    try {
      await updateMasteryProfile({
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
    } catch (error) {
      console.error("[adaptive.submit.masteryRefresh]", error);
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
      console.error("[adaptive.submit.performanceEvent]", error);
    });

    return NextResponse.json({
      score,
      passed: score >= 0.7,
      nextTier,
    });
  } catch (error: any) {
    console.error("[adaptive.submit.POST]", error);
    return NextResponse.json(
      { error: error?.message ?? "Server error" },
      { status: error?.status ?? 500 }
    );
  }
}
