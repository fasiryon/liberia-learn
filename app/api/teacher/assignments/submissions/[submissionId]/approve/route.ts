import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";

export const dynamic = "force-dynamic";

const ApproveBodySchema = z.object({
  overrideGrade: z.number().int().min(0).max(100).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { submissionId: string } },
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = ApproveBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: params.submissionId },
      include: {
        Assignment: {
          select: {
            id: true,
            title: true,
            classId: true,
            Class: {
              select: {
                schoolId: true,
                teacherId: true,
                name: true,
              },
            },
          },
        },
        Student: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
            guardians: { select: { guardianId: true } },
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.Assignment.Class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role !== "ADMIN" && submission.Assignment.Class.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (submission.aiGrade === null) {
      return NextResponse.json({ error: "No AI grade to approve" }, { status: 400 });
    }

    const finalGrade = parsed.data.overrideGrade ?? submission.aiGrade;
    const now = new Date();

    const updated = await prisma.assignmentSubmission.update({
      where: { id: params.submissionId },
      data: {
        score: finalGrade,
        feedback: submission.aiFeedback ?? undefined,
        gradedAt: now,
        gradedBy: user.id,
        teacherApproved: true,
        approvedAt: now,
      },
    });

    logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "homework.ai_grade_approved",
      resourceType: "assignment_submission",
      resourceId: updated.id,
      details: {
        assignmentId: submission.Assignment.id,
        aiGrade: submission.aiGrade,
        finalGrade,
        overridden: parsed.data.overrideGrade !== undefined,
      },
    });

    const studentUserId = submission.Student.user.id;

    sendPushToUser(studentUserId, {
      title: "Assignment Graded",
      body: `Your ${submission.Assignment.title} has been graded. Score: ${finalGrade}/100`,
      url: `/student/assignments/${submission.assignmentId}`,
    }).catch(() => null);

    const guardianIds = submission.Student.guardians
      .map((g) => g.guardianId)
      .filter((id): id is string => Boolean(id));

    for (const guardianId of guardianIds) {
      sendGuardianSMS({
        schoolId: user.schoolId,
        studentId: submission.Student.id,
        guardianId,
        messageType: "custom",
        payload: {
          message: `${submission.Student.user.name ?? "Your student"} received ${finalGrade}/100 on ${submission.Assignment.title}. Log in to LiberiaLearn to see feedback.`,
          studentName: submission.Student.user.name ?? "Student",
          assignmentTitle: submission.Assignment.title,
          schoolName: "",
        },
        actorUserId: user.id,
        idempotencyKey: `assignment-graded:${submission.id}:${guardianId}`,
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      submission: {
        id: updated.id,
        grade: updated.score,
        teacherApproved: updated.teacherApproved,
        approvedAt: updated.approvedAt?.toISOString() ?? null,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to approve grade";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
