/**
 * app/api/grading/[submissionId]/override/route.ts  — NR-14C Phase 1
 *
 * PATCH /api/grading/[submissionId]/override
 *
 * Teacher can override an AI-suggested essay grade.
 * Only TEACHER, ADMIN, and platform-admin roles may call this.
 *
 * Body: { score: number (0..1), feedback?: string }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: { submissionId: string } }
) {
  try {
    // Only teachers and admins can override grades
    const user = await requireRole("TEACHER", "ADMIN");

    const body = await req.json().catch(() => null);
    const { score, feedback }: { score?: unknown; feedback?: unknown } = body ?? {};

    if (typeof score !== "number" || score < 0 || score > 1) {
      return NextResponse.json(
        { error: "score must be a number between 0 and 1" },
        { status: 400 }
      );
    }

    const existing = await prisma.gradedSubmission.findUnique({
      where: { id: params.submissionId },
      select: {
        id: true,
        exerciseType: true,
        student: { select: { user: { select: { schoolId: true } } } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }
    if (
      existing.student.user.schoolId !== user.schoolId &&
      !user.isPlatformAdmin
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.gradedSubmission.update({
      where: { id: params.submissionId },
      data: {
        score,
        feedback:
          typeof feedback === "string" && feedback.length > 0
            ? feedback
            : undefined,
        status: "graded",
        gradedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, submission: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "internal_error";
    const status = msg.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
