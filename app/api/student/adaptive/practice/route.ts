import { NextRequest, NextResponse } from "next/server";
// route-policy: auth=session; scope=tenant; authority=student-membership; rationale=practice generation is bound to the authenticated learner and school
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkAiRateLimit } from "@/lib/ai/rateLimitGuard";
import { getRateLimitHeaders, rateLimitExceededResponse } from "@/lib/rateLimit";
import { prisma } from "@/lib/db";
import { isAdaptiveEngineEnabled } from "@/lib/serverFlags";
import { detectMasteryGaps } from "@/lib/adaptive/gapDetector";
import {
  computeDifficultyTier,
  type AttemptRecord,
} from "@/lib/adaptive/difficultyAdapter";
import { generateTargetedPracticeWithUsage } from "@/lib/adaptive/practiceGenerator";
import { logger } from "@/lib/logger";
import { projectAdaptivePracticeForLearner, sealAdaptivePracticeSession } from "@/lib/adaptive/practiceSession";

export const dynamic = "force-dynamic";

type PracticeBody = {
  strandCode?: string;
  difficultyTier?: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!isAdaptiveEngineEnabled()) {
      return NextResponse.json({ error: "adaptive_engine_disabled" }, { status: 404 });
    }

    const user = await requireRole("STUDENT");
    const rateLimit = await checkAiRateLimit({
      userId: user.id,
      role: user.role,
      endpoint: "/api/student/adaptive/practice",
      schoolId: user.schoolId ?? undefined,
    });
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(rateLimit);
    }

    const student = await prisma.student.findFirst({
      where: {
        userId: user.id,
        user: { schoolId: user.schoolId ?? null },
      },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ error: "student_not_found" }, { status: 404 });
    }

    const body = (await req.json()) as PracticeBody;
    if (typeof body?.strandCode !== "string" || body.strandCode.trim().length === 0) {
      return NextResponse.json({ error: "invalid_strand_code" }, { status: 400 });
    }

    const gaps = await detectMasteryGaps(student.id);
    const gap = gaps.find((entry) => entry.strand === body.strandCode);
    if (!gap) {
      return NextResponse.json({ error: "gap_not_found" }, { status: 404 });
    }

    const recentAttempts = await (prisma as any).studentAdaptiveAttempt.findMany({
      where: { studentId: student.id, strandCode: body.strandCode },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: { score: true, completedAt: true },
    });
    const tier = computeDifficultyTier(gap, recentAttempts as AttemptRecord[]);
    const generation = await generateTargetedPracticeWithUsage(gap, tier, {
      route: "/api/student/adaptive/practice",
      schoolId: user.schoolId ?? null,
      userId: user.id,
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "student.adaptive.practice.generated",
      resourceType: "adaptive_practice",
      resourceId: gap.strand,
      details: {
        subject: gap.subject,
        difficultyTier: tier,
        requestedDifficultyTier: body.difficultyTier ?? null,
        hadFallback: generation.hadFallback === true,
      },
    });

    const sealed = sealAdaptivePracticeSession({
      userId: user.id,
      strandCode: gap.strand,
      questions: generation.practice.questions,
    });
    const response = NextResponse.json(
      {
        practice: projectAdaptivePracticeForLearner(generation.practice, sealed.practiceSetId),
        hadFallback: generation.hadFallback === true,
      },
      { headers: getRateLimitHeaders(rateLimit) }
    );
    response.cookies.set("adaptive_practice_session", sealed.token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/api/student/adaptive/submit",
      maxAge: 2 * 60 * 60,
    });
    return response;
  } catch (error: any) {
    logger.error("[adaptive.practice.POST]", {
      route: "/api/student/adaptive/practice",
      error,
      status: error?.status ?? 500,
    });
    return NextResponse.json(
      { error: error?.message ?? "Server error" },
      { status: error?.status ?? 500 }
    );
  }
}
