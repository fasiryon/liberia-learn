import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { notifyAssignmentSubmitted } from "@/lib/assignment-notifications";
import { prisma } from "@/lib/db";
import { getAssignmentTargetStudentIds } from "@/lib/assignments/targeting";
import { recordSloEvent } from "@/lib/slo/tracker";
import { logProductSignal } from "@/lib/autonomous/signals/productSignalService";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const startedAt = Date.now();
  try {
    const user = await requireRole("STUDENT");
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "Assignment content is required." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        user: { select: { name: true, schoolId: true } },
        enrollments: { select: { classId: true } },
      },
    });
    if (!student) {
      return NextResponse.json({ error: "Student record not found." }, { status: 404 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      include: {
        Class: {
          select: {
            id: true,
            schoolId: true,
            School: { select: { name: true } },
          },
        },
      },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
    }

    const isEnrolled = student.enrollments.some((enrollment) => enrollment.classId === assignment.classId);
    if (!isEnrolled || assignment.Class.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const targetStudentIds = await getAssignmentTargetStudentIds(assignment.id);
    if (targetStudentIds.length > 0 && !targetStudentIds.includes(student.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const submission = await prisma.assignmentSubmission.upsert({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId: student.id } },
      create: {
        assignmentId: assignment.id,
        studentId: student.id,
        turnedInAt: new Date(),
        content,
      },
      update: {
        turnedInAt: new Date(),
        content,
      },
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId ?? null,
      action: "assignment.submitted",
      resourceType: "assignment_submission",
      resourceId: submission.id,
      details: {
        assignmentId: assignment.id,
      },
    });

    await logProductSignal({
      schoolId: assignment.Class.schoolId,
      classId: assignment.classId,
      userId: user.id,
      studentId: student.id,
      actor: { type: "student", id: user.id, role: "STUDENT" },
      target: { type: "assignment_submission", id: submission.id },
      eventType: "assignment.submitted",
      source: "/api/student/assignments/[id]/submit",
      contentId: assignment.contentId ?? null,
      dedupeKey: `assignment.submitted:${assignment.Class.schoolId}:${submission.id}`,
      metadata: {
        assignmentId: assignment.id,
        submittedAt: submission.turnedInAt?.toISOString() ?? null,
        contentLength: content.length,
      },
    });

    await notifyAssignmentSubmitted({
      actorUserId: user.id,
      schoolId: assignment.Class.schoolId,
      schoolName: assignment.Class.School?.name ?? "School",
      studentId: student.id,
      studentName: student.user.name?.trim() || "Student",
      assignmentTitle: assignment.title,
    }).catch(() => null);

    recordSloEvent({
      service: "submit",
      success: true,
      latencyMs: Date.now() - startedAt,
      schoolId: user.schoolId ?? null,
    });

    return NextResponse.json({ ok: true, submissionId: submission.id, submittedAt: submission.turnedInAt });
  } catch (err: any) {
    recordSloEvent({
      service: "submit",
      success: false,
      latencyMs: Date.now() - startedAt,
      schoolId: null,
    });
    return NextResponse.json({ error: err?.message ?? "Failed to submit assignment." }, { status: err?.status ?? 500 });
  }
}
