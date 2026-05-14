import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireRole("GUARDIAN").catch(() => null);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  // Verify guardian is linked to student
  const link = await prisma.studentGuardian.findFirst({
    where: { guardianId: user.id, studentId },
  });
  if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Get the student's enrollments to find their classes
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classId: true },
  });
  const classIds = enrollments.map((e) => e.classId);

  if (classIds.length === 0) {
    return NextResponse.json({ assignments: [] });
  }

  const now = new Date();

  // Get assignments for student's classes
  const assignments = await prisma.assignment.findMany({
    where: { classId: { in: classIds } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      Class: { select: { subject: true, name: true } },
      submissions: {
        where: { studentId },
        select: { id: true, score: true, turnedInAt: true, gradedAt: true },
      },
    },
  });

  const result = assignments.map((a) => {
    const submission = a.submissions[0] ?? null;
    let status: "submitted" | "overdue" | "upcoming";
    if (submission) {
      status = "submitted";
    } else if (a.dueAt && a.dueAt < now) {
      status = "overdue";
    } else {
      status = "upcoming";
    }
    return {
      id: a.id,
      title: a.title,
      description: a.description ?? null,
      dueAt: a.dueAt?.toISOString() ?? null,
      points: a.points,
      subject: String(a.Class.subject),
      className: a.Class.name,
      status,
      submission: submission
        ? {
            id: submission.id,
            score: submission.score,
            submittedAt: submission.turnedInAt?.toISOString() ?? null,
          }
        : null,
    };
  });

  return NextResponse.json({ assignments: result });
}
