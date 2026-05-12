import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { notifyAssignmentGraded } from "@/lib/assignment-notifications";
import { sendPushToUser } from "@/lib/push/sendPush";

export const dynamic = "force-dynamic";

const GradeBodySchema = z.object({
  grade: z.number().int().min(0).max(100),
  feedback: z.string().trim().max(2000).default(""),
  rubricScore: z.record(z.string(), z.number()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { submissionId: string } }
) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = GradeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const submission = await prisma.assignmentSubmission.findUnique({
      where: { id: params.submissionId },
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
            user: { select: { id: true, name: true, email: true } },
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

    const updated = await prisma.assignmentSubmission.update({
      where: { id: params.submissionId },
      data: {
        score: parsed.data.grade,
        feedback: parsed.data.feedback,
        gradedAt: new Date(),
        gradedBy: user.id,
        rubricScore: parsed.data.rubricScore ? JSON.parse(JSON.stringify(parsed.data.rubricScore)) : null,
      },
    });

    logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "gradebook.entry.created",
      resourceType: "assignment_submission",
      resourceId: updated.id,
      details: { assignmentId: submission.Assignment.id, grade: parsed.data.grade },
    });

    notifyAssignmentGraded({
      actorUserId: user.id,
      schoolId: user.schoolId,
      schoolName: submission.Assignment.Class.School?.name ?? "School",
      studentId: submission.Student.id,
      studentName: submission.Student.user.name?.trim() || "Student",
      assignmentTitle: submission.Assignment.title,
      score: parsed.data.grade,
    }).catch(() => null);

    const studentUserId = submission.Student.user.id;
    if (studentUserId) {
      sendPushToUser(studentUserId, {
        title: "Assignment graded",
        body: `${submission.Assignment.title}: ${parsed.data.grade}/100`,
        url: "/assignments",
      }).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      submission: {
        id: updated.id,
        grade: updated.score,
        feedback: updated.feedback,
        gradedAt: updated.gradedAt?.toISOString() ?? null,
        gradedBy: updated.gradedBy,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to grade submission";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
