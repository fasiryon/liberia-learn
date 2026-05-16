import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendPushToUser } from "@/lib/push/sendPush";
import { sendGuardianSMS } from "@/lib/guardian/sms-service";

export const dynamic = "force-dynamic";

const BulkApproveSchema = z.object({
  assignmentId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = BulkApproveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: parsed.data.assignmentId },
      select: {
        id: true,
        title: true,
        Class: {
          select: {
            schoolId: true,
            teacherId: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    if (assignment.Class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.role !== "ADMIN" && assignment.Class.teacherId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pending = await prisma.assignmentSubmission.findMany({
      where: {
        assignmentId: parsed.data.assignmentId,
        aiGrade: { not: null },
        teacherApproved: false,
        autoReleasedAt: null,
      },
      include: {
        Student: {
          select: {
            id: true,
            user: { select: { id: true, name: true } },
            guardians: { select: { guardianId: true } },
          },
        },
      },
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, approved: 0 });
    }

    const now = new Date();
    await prisma.assignmentSubmission.updateMany({
      where: {
        id: { in: pending.map((s) => s.id) },
      },
      data: {
        score: undefined, // set per-row below
        teacherApproved: true,
        approvedAt: now,
        gradedAt: now,
        gradedBy: user.id,
      },
    });

    // Set score per submission (updateMany can't use per-row computed values)
    await Promise.all(
      pending.map((s) =>
        prisma.assignmentSubmission.update({
          where: { id: s.id },
          data: {
            score: s.aiGrade!,
            feedback: s.aiFeedback ?? undefined,
            teacherApproved: true,
            approvedAt: now,
            gradedAt: now,
            gradedBy: user.id,
          },
        }),
      ),
    );

    logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "homework.ai_grade_bulk_approved",
      resourceType: "assignment",
      resourceId: parsed.data.assignmentId,
      details: { count: pending.length, assignmentTitle: assignment.title },
    });

    for (const sub of pending) {
      const grade = sub.aiGrade!;

      sendPushToUser(sub.Student.user.id, {
        title: "Assignment Graded",
        body: `Your ${assignment.title} has been graded. Score: ${grade}/100`,
        url: `/student/assignments/${sub.assignmentId}`,
      }).catch(() => null);

      const guardianIds = sub.Student.guardians
        .map((g) => g.guardianId)
        .filter((id): id is string => Boolean(id));

      for (const guardianId of guardianIds) {
        sendGuardianSMS({
          schoolId: user.schoolId!,
          studentId: sub.Student.id,
          guardianId,
          messageType: "custom",
          payload: {
            message: `${sub.Student.user.name ?? "Your student"} received ${grade}/100 on ${assignment.title}. Log in to LiberiaLearn to see feedback.`,
            studentName: sub.Student.user.name ?? "Student",
            assignmentTitle: assignment.title,
            schoolName: "",
          },
          actorUserId: user.id,
          idempotencyKey: `assignment-graded:${sub.id}:${guardianId}`,
        }).catch(() => null);
      }
    }

    return NextResponse.json({ ok: true, approved: pending.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to bulk approve grades";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
