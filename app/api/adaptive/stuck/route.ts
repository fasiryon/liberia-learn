/**
 * POST /api/adaptive/stuck
 *
 * Detects whether a student is stuck on a lesson and, if so,
 * decides where to route them (scaffold | prerequisite | ai_tutor).
 *
 * Auth:  STUDENT role required (requireUser pattern)
 * Audit: logs a StuckEvent when stuck=true
 *
 * Body:
 *   { lessonId, wrongCount, lastResponseMs, attemptCount }
 *
 * Returns:
 *   { isStuck, route? }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { detectStuck } from "@/lib/adaptive/detectStuck";
import { routeStuck } from "@/lib/adaptive/routeStuck";

type StuckBody = {
  lessonId?: string;      // CurriculumContent.id
  scheduledWorkId?: string; // alias accepted for convenience
  wrongCount?: number;
  lastResponseMs?: number;
  attemptCount?: number;
  gradeBand?: "lower" | "upper";
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");

    const body = (await req.json()) as StuckBody;
    const lessonId = body.lessonId ?? body.scheduledWorkId;
    if (!lessonId || typeof lessonId !== "string") {
      return NextResponse.json({ error: "lessonId_required" }, { status: 400 });
    }

    const wrongCount = Number(body.wrongCount ?? 0);
    const lastResponseMs = Number(body.lastResponseMs ?? 0);
    const attemptCount = Number(body.attemptCount ?? 0);
    const gradeBand = body.gradeBand ?? "upper";

    // Resolve student record
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "student_not_found" }, { status: 404 });
    }

    const check = detectStuck({ wrongCount, lastResponseMs, attemptCount, gradeBand });

    if (!check.isStuck) {
      return NextResponse.json({ isStuck: false });
    }

    // Route the stuck student
    const route = await routeStuck({ studentId: student.id, lessonId });

    // Log a StuckEvent (fire-and-forget — don't fail the response if this errors)
    void prisma.stuckEvent
      .create({
        data: {
          studentId: student.id,
          lessonId,
          signal: check.signal!,
          detail: check.detail ? (check.detail as import("@prisma/client").Prisma.InputJsonValue) : undefined,
          routedTo: route.to,
        },
      })
      .catch(() => null);

    return NextResponse.json({ isStuck: true, signal: check.signal, route });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "stuck_check_failed" },
      { status: error?.status ?? 500 }
    );
  }
}
