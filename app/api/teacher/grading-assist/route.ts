import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isAiGradingAssistEnabled } from "@/lib/serverFlags";
import { getGradingAssistance } from "@/lib/teacher/gradingAssist";

const RequestSchema = z.object({
  submissionId: z.string().trim().min(1),
  studentAnswer: z.string().trim().min(1).max(10000),
  objectives: z.array(z.string().trim().min(1)).max(12).default([]),
  rubric: z.string().trim().max(4000).optional(),
  action: z.enum(["suggest", "reject"]).default("suggest"),
});

export async function POST(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isAiGradingAssistEnabled()) {
      return NextResponse.json({ error: "ai_grading_assist_disabled" }, { status: 404 });
    }
    const user = await requireRole("TEACHER");
    const body = RequestSchema.parse(await req.json());

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: body.submissionId },
      include: {
        Assignment: {
          select: {
            id: true,
            title: true,
            Class: { select: { id: true, schoolId: true, teacherId: true } },
          },
        },
      },
    });
    if (
      !submission ||
      !user.schoolId ||
      submission.Assignment.Class.schoolId !== user.schoolId ||
      submission.Assignment.Class.teacherId !== user.id
    ) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (body.action === "reject") {
      await logAudit({
        userId: user.id,
        action: "ai_grading_assist_rejected",
        resourceType: "assignment_submission",
        resourceId: body.submissionId,
        schoolId: user.schoolId,
        traceId,
        details: { assignmentId: submission.Assignment.id },
      });
      return NextResponse.json({ ok: true });
    }

    const suggestion = await getGradingAssistance({
      teacherId: user.id,
      submissionId: body.submissionId,
      studentAnswer: submission.content?.trim() || body.studentAnswer,
      lessonObjectives: body.objectives,
      rubric: body.rubric,
    });

    await logAudit({
      userId: user.id,
      action: "ai_grading_assist_requested",
      resourceType: "assignment_submission",
      resourceId: body.submissionId,
      schoolId: user.schoolId,
      traceId,
      details: {
        assignmentId: submission.Assignment.id,
        confidence: suggestion.confidence,
        suggestedScore: suggestion.suggestedScore,
      },
    });

    return NextResponse.json(suggestion);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to get grading assistance" },
      { status: err?.status ?? 500 }
    );
  }
}
