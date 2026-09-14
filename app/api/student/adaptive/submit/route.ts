import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=student-membership; rationale=server-scored practice is bound to the learner, school, and sealed item session
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { detectMasteryGaps } from "@/lib/adaptive/gapDetector";
import {
  computeDifficultyTier,
  type AttemptRecord,
} from "@/lib/adaptive/difficultyAdapter";
import { isAdaptiveEngineEnabled } from "@/lib/serverFlags";
import { logger } from "@/lib/logger";
import { openAdaptivePracticeSession, scoreAdaptiveAnswers } from "@/lib/adaptive/practiceSession";

export const dynamic = "force-dynamic";

type SubmitBody = {
  strandCode?: string;
  practiceSetId?: string;
  answers?: number[];
  correctAnswers?: number[]; // Legacy compatibility only. Never authoritative.
  durationSeconds?: number;
  aiAssistUsed?: boolean;
  attempts?: number;
};

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
      !Array.isArray(body?.answers)
    ) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const practiceSession = openAdaptivePracticeSession(
      req.cookies.get("adaptive_practice_session")?.value ?? "",
      user.id,
      body.practiceSetId
    );
    if (!practiceSession || practiceSession.strandCode !== body.strandCode) {
      return NextResponse.json({ error: "adaptive_practice_session_invalid_or_expired" }, { status: 400 });
    }
    const { score, incorrectAnswerIndices } = scoreAdaptiveAnswers(body.answers, practiceSession.correctIndices);
    const context = await resolveAttemptContext(student.id, body.strandCode, student.currentGrade ?? 0);

    const recentAttemptsBeforeWrite = await (prisma as any).studentAdaptiveAttempt.findMany({
      where: { studentId: student.id, strandCode: body.strandCode },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { score: true, completedAt: true },
    });

    const difficultyTier = computeDifficultyTier(context, recentAttemptsBeforeWrite as AttemptRecord[]);
    const recentAttempts = [
      { score, completedAt: new Date() },
      ...recentAttemptsBeforeWrite,
    ].slice(0, 10);

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
        provisionalScore: score,
        evidenceStatus: "PROVISIONAL_UNBOUND",
        nextTier,
      },
    });

    return NextResponse.json({
      score,
      passed: score >= 0.7,
      nextTier,
      evidenceStatus: "PROVISIONAL_UNBOUND",
      masteryUpdated: false,
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
