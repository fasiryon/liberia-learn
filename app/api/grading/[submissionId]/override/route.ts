/**
 * app/api/grading/[submissionId]/override/route.ts  — NR-14C Phase 1
 *
 * PATCH /api/grading/[submissionId]/override
 *
 * Teacher can override an AI-suggested essay grade.
 * Only TEACHER and ADMIN roles may call this; a platform role is not academic authority, so there is no bypass.
 *
 * AT-GRADE-01: this is ADVISORY assessment review (COS-CLASS-AUTHORITY-DESIGN.md section A). It changes only the
 * advisory GradedSubmission, never an official score, report card, promotion or mastery record. The reviewer needs
 * class.assessment.review for a class the learner is enrolled in, for the lesson's subject; a reason is required; the
 * update and its audit row commit in one transaction. Only essay submissions that already carry a successful AI
 * suggestion: a pending or failed AI run is not eligible for ordinary AI-score review (founder decision, 2026-10-27).
 *
 * Body: { score: number (0..1), reason: string, feedback?: string }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, type SessionUser } from "@/lib/auth";
import { logAuditRequired } from "@/lib/audit";
import { authorizeClassAccess, isClassAccessAllowed, type ClassAuthorityBasis } from "@/lib/authz/classAuthority";

// route-policy: auth=session; scope=record; authority=class-assessment-review; rationale=advisory review of a successful AI essay suggestion by the learner's class teacher, a subject co-teacher of that class and the lesson's subject, or an ADMIN of the learner's school (lib/authz/classAuthority class.assessment.review); no platform-admin bypass; pending or failed AI runs are not reviewable; reason required; update and audit in one transaction; no official-record write

type ReviewedSubmission = Readonly<{ studentId: string; lessonId: string; student: { user: { schoolId: string | null } } }>;

/** The basis on which this user may review the learner's advisory submission, or null (deny by default). */
async function reviewBasis(user: SessionUser, submission: ReviewedSubmission): Promise<ClassAuthorityBasis | null> {
  const learnerSchoolId = submission.student.user.schoolId;
  if (!learnerSchoolId || learnerSchoolId !== user.schoolId) return null;
  const lesson = await prisma.curriculumContent.findUnique({ where: { id: submission.lessonId }, select: { subject: true } });
  if (!lesson) return null;
  const enrollments = await prisma.enrollment.findMany({ where: { studentId: submission.studentId }, select: { classId: true } });
  for (const { classId } of enrollments) {
    const decision = await authorizeClassAccess(user, { classId, subject: lesson.subject, fn: "class.assessment.review" });
    if (isClassAccessAllowed(decision)) return decision.basis;
  }
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: { submissionId: string } }
) {
  try {
    // Only teachers and admins can override grades
    const user = await requireRole("TEACHER", "ADMIN");

    const body = await req.json().catch(() => null);
    const { score, feedback, reason }: { score?: unknown; feedback?: unknown; reason?: unknown } = body ?? {};

    if (typeof score !== "number" || score < 0 || score > 1) {
      return NextResponse.json(
        { error: "score must be a number between 0 and 1" },
        { status: 400 }
      );
    }
    if (typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json({ error: "reason_required" }, { status: 400 });
    }

    const existing = await prisma.gradedSubmission.findUnique({
      where: { id: params.submissionId },
      select: {
        id: true,
        exerciseType: true,
        status: true,
        score: true,
        studentId: true,
        lessonId: true,
        student: { select: { user: { select: { schoolId: true } } } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
    }
    const basis = await reviewBasis(user, existing);
    if (!basis) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing.exerciseType !== "essay") {
      return NextResponse.json({ error: "override_essay_only" }, { status: 409 });
    }
    if (existing.score === null || existing.status === "pending" || existing.status === "failed") {
      return NextResponse.json({ error: "override_requires_ai_suggestion" }, { status: 409 });
    }

    // A human review replaces an AI-suggested score; who changed it, from what, why and on what basis is written in the
    // same transaction, so the change is never kept without its audit row.
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.gradedSubmission.update({
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
      await logAuditRequired({
        userId: user.id,
        schoolId: existing.student.user.schoolId ?? user.schoolId ?? null,
        action: "grading.submission.override",
        resourceType: "graded_submission",
        resourceId: existing.id,
        details: {
          studentId: existing.studentId,
          exerciseType: existing.exerciseType,
          previousScore: existing.score ?? null,
          newScore: score,
          reason: reason.trim(),
          basis,
        },
      }, tx);
      return row;
    });

    return NextResponse.json({ ok: true, submission: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "internal_error";
    const status = msg.includes("Unauthorized") || msg.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
