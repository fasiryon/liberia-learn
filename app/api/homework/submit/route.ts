import { requireTenant } from "@/lib/tenant"
// app/api/homework/submit/route.ts
// FIXED: was fully unauthenticated and accepted studentId from request body.
// Now: session required, studentId derived from session only.
// NR-14A: added clientSubmissionId for offline idempotency — same UUID ⟹ same record.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function POST(req: Request) {
  const { schoolId } = await requireTenant();
  try {
    const user = await requireRole("STUDENT");

    // Look up the Student record for this logged-in user
    const student = await prisma.student.findFirst({
      where: { userId: user.id },
    });
    if (!student) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { homeworkId, answers, clientSubmissionId } = body ?? {};

    if (!homeworkId || !answers) {
      return NextResponse.json(
        { error: "homeworkId and answers are required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(answers)) {
      return NextResponse.json(
        { error: "answers must be an array" },
        { status: 400 }
      );
    }

    // NR-14A: Idempotency fast-path — if the client already has a confirmed
    // submission with this UUID, return it without hitting the DB again.
    if (clientSubmissionId) {
      try {
        const existing = await prisma.homeworkSubmission.findUnique({
          where: { clientSubmissionId },
        });
        if (existing) {
          return NextResponse.json({ ok: true, submission: existing }, { status: 200 });
        }
      } catch {
        // clientSubmissionId column may not exist on older DB — fall through to upsert
      }
    }

    // Verify homework exists and student is enrolled in that class
    const homework = await prisma.homework.findFirst({
      where: { id: homeworkId, Class: { schoolId } },
      include: {
        Class: {
          include: {
            enrollments: { where: { studentId: student.id } },
          },
        },
      },
    });

    if (!homework) {
      return NextResponse.json({ error: "Homework not found" }, { status: 404 });
    }
    if (homework.Class.enrollments.length === 0) {
      return NextResponse.json(
        { error: "You are not enrolled in this class" },
        { status: 403 }
      );
    }

    // Upsert so double-submits are safe (belt + suspenders alongside clientSubmissionId)
    const submission = await prisma.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: {
          homeworkId,
          studentId: student.id,
        },
      },
      create: {
        homeworkId,
        studentId: student.id,
        answers,
        submittedAt: new Date(),
        ...(clientSubmissionId ? { clientSubmissionId } : {}),
      },
      update: {
        answers,
        submittedAt: new Date(),
        // Only set clientSubmissionId once — don't overwrite with null on subsequent syncs
        ...(clientSubmissionId ? { clientSubmissionId } : {}),
      },
    });

    return NextResponse.json({ ok: true, submission }, { status: 200 });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Failed to submit homework" },
      { status }
    );
  }
}
