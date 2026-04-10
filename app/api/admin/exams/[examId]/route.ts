import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  assertExamScopeContext,
  getExamDetailForSchool,
  updateExamSchema,
} from "@/lib/exams/examAuthority";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN" && user.role !== "TEACHER" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }
    const schoolId =
      user.role === "TEACHER" && !user.isPlatformAdmin
        ? user.schoolId ?? null
        : resolveAdminSchoolScope(user, null);
    if (!schoolId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const exam = await getExamDetailForSchool(schoolId, context.params.examId);

    return NextResponse.json({ exam });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const schoolId = resolveAdminSchoolScope(user, null);
    const exam = await prisma.exam.findFirst({
      where: { id: context.params.examId, schoolId, deletedAt: null },
      select: { id: true, status: true, publishedAt: true, resultsPublishedAt: true },
    });
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = updateExamSchema.parse(await req.json());
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const scoped = await assertExamScopeContext(schoolId, {
      academicYearId: body.academicYearId,
      classId: body.classId,
      subject: body.subject,
    });

    if (body.status === "PUBLISHED") {
      const questionCount = await prisma.examQuestion.count({
        where: { examId: exam.id },
      });
      if (questionCount < 5) {
        return NextResponse.json(
          { error: "Exam must contain at least 5 questions before publishing" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.exam.update({
      where: { id: exam.id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(body.grade !== undefined ? { grade: body.grade } : {}),
        ...(body.moeStandards !== undefined ? { moeStandards: body.moeStandards } : {}),
        ...(body.timeLimit !== undefined ? { timeLimit: body.timeLimit } : {}),
        ...(body.passingScore !== undefined ? { passingScore: body.passingScore } : {}),
        ...(body.academicYearId !== undefined ? { academicYearId: scoped.academicYearId ?? null } : {}),
        ...(body.classId !== undefined ? { classId: scoped.classId ?? null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.status === "PUBLISHED" && !exam.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });

    await logAudit({
      userId: user.id,
      schoolId,
      action: "exam.updated",
      resourceType: "exam",
      resourceId: updated.id,
      details: body,
    });

    return NextResponse.json({ exam: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const schoolId = resolveAdminSchoolScope(user, null);
    const exam = await prisma.exam.findFirst({
      where: { id: context.params.examId, schoolId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (exam.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft exams can be deleted" }, { status: 400 });
    }

    await prisma.exam.update({
      where: { id: exam.id },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      userId: user.id,
      schoolId,
      action: "exam.deleted",
      resourceType: "exam",
      resourceId: exam.id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
