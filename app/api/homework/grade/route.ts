import { requireTenant } from "@/lib/tenant"
// app/api/homework/grade/route.ts
// FIXED: was no auth check -- any caller could write grades.
// Now: TEACHER or ADMIN only.
// NOTE: Teacher-to-school binding enforcement is Sprint 2.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function POST(req: Request) {
  const { schoolId } = await requireTenant();
  try {
    const user = await requireRole("TEACHER", "ADMIN");

    const body = await req.json();
    const { submissionId, teacherScore, teacherNotes } = body ?? {};

    if (!submissionId || typeof teacherScore !== "number") {
      return NextResponse.json(
        { error: "submissionId and numeric teacherScore are required" },
        { status: 400 }
      );
    }
    if (teacherScore < 0 || teacherScore > 100) {
      return NextResponse.json(
        { error: "teacherScore must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Load submission to get classId for ownership check
    const submission = await prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: { Homework: { select: { classId: true } } },
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Teachers can only grade their own classes (basic check by teacherId on Class)
    // If your Class model doesn't have teacherId yet, remove this block.
    if (user.role === "TEACHER") {
      const cls = await prisma.class.findUnique({
        where: { id: submission.Homework.classId },
        select: { teacherId: true },
      });
      if (cls?.teacherId && cls.teacherId !== user.id) {
        return NextResponse.json({ error: "Not your class" }, { status: 403 });
      }
    }

    const updated = await prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: { teacherScore, teacherNotes },
      include: { Homework: { select: { classId: true } } },
    });

    const classId   = updated.Homework.classId;
    const studentId = updated.studentId;

    // Recompute class average -> write Grade row (simple path for Sprint 1)
    const gradedSubs = await prisma.homeworkSubmission.findMany({
      where: {
        studentId,
        teacherScore: { not: null },
        Homework: { classId },
      },
      select: { teacherScore: true },
    });

    if (gradedSubs.length > 0) {
      const avg = gradedSubs.reduce((s, x) => s + (x.teacherScore ?? 0), 0) / gradedSubs.length;
      const percent = Math.round(avg);
      const letter  = percent >= 90 ? "A" : percent >= 80 ? "B" : percent >= 70 ? "C" : percent >= 60 ? "D" : "F";

      const existing = await prisma.grade.findFirst({ where: { classId, studentId } });
      if (existing) {
        await prisma.grade.update({ where: { id: existing.id }, data: { percent, letter } });
      } else {
        await prisma.grade.create({ data: { classId, studentId, percent, letter } });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to save grade" },
      { status: err?.status ?? 500 }
    );
  }
}

