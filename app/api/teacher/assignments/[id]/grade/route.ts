import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyAssignmentGraded } from "@/lib/assignment-notifications";
import { createInboxNotification } from "@/lib/notifications/inboxService";

export const dynamic = "force-dynamic";

const GradeSchema = z.object({
  grade: z.number().int().min(0).max(100),
  feedback: z.string().trim().min(3).max(2000),
  aiGradingAssistAction: z.enum(["accepted", "edited"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const parsed = GradeSchema.parse(await req.json());
    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: params.id },
      include: {
        Assignment: {
          select: {
            id: true,
            title: true,
            Class: {
              select: {
                schoolId: true,
                teacherId: true,
                School: { select: { name: true } },
              },
            },
          },
        },
        Student: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Assignment submission not found" }, { status: 404 });
    }

    if (submission.Assignment.Class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role !== "ADMIN" && submission.Assignment.Class.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.assignmentSubmission.update({
      where: { id: params.id },
      data: {
        score: parsed.grade,
        feedback: parsed.feedback,
        gradedAt: new Date(),
        gradedBy: user.id,
      },
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "assignment.graded",
      resourceType: "assignment_submission",
      resourceId: updated.id,
      details: {
        assignmentId: submission.Assignment.id,
        grade: parsed.grade,
      },
    });

    if (parsed.aiGradingAssistAction) {
      await logAudit({
        userId: user.id,
        schoolId: user.schoolId,
        action:
          parsed.aiGradingAssistAction === "accepted"
            ? "ai_grading_assist_accepted"
            : "ai_grading_assist_edited",
        resourceType: "assignment_submission",
        resourceId: updated.id,
        details: {
          assignmentId: submission.Assignment.id,
          grade: parsed.grade,
        },
      });
    }

    try {
      await notifyAssignmentGraded({
        actorUserId: user.id,
        schoolId: user.schoolId,
        schoolName: submission.Assignment.Class.School?.name ?? "School",
        studentId: submission.Student.id,
        studentName: submission.Student.user.name?.trim() || "Student",
        assignmentTitle: submission.Assignment.title,
        score: parsed.grade,
      });
    } catch (notificationError) {
      console.error("Assignment grade notification failed", notificationError);
    }

    // Inbox notification — fire-and-forget
    void (async () => {
      await createInboxNotification(submission.Student.user.id, {
        title: "Assignment Graded",
        body: `Your submission for "${submission.Assignment.title}" received ${parsed.grade}/100`,
        url: "/assignments",
        type: "grade",
      });
    })().catch(() => null);

    return NextResponse.json({
      ok: true,
      submission: {
        id: updated.id,
        score: updated.score,
        feedback: updated.feedback,
        gradedAt: updated.gradedAt?.toISOString() ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to grade assignment" }, { status: err?.status ?? 500 });
  }
}
