import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import {
  assertExamScopeContext,
  buildExamQuestionCreates,
  createExamSchema,
  listExamsForSchool,
  listExamSupportData,
} from "@/lib/exams/examAuthority";
import { prisma } from "@/lib/db";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN" && user.role !== "TEACHER" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const url = new URL(req.url);
    const schoolId =
      user.role === "TEACHER" && !user.isPlatformAdmin
        ? user.schoolId ?? null
        : resolveAdminSchoolScope(user, url.searchParams.get("schoolId"));

    if (!schoolId) {
      return NextResponse.json({ exams: [] });
    }

    const filters = {
      status: url.searchParams.get("status"),
      subject: url.searchParams.get("subject"),
      grade: url.searchParams.get("grade")
        ? Number(url.searchParams.get("grade"))
        : null,
    };
    const [exams, support] = await Promise.all([
      listExamsForSchool(schoolId, filters),
      listExamSupportData(schoolId),
    ]);

    return NextResponse.json({
      exams,
      support,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    }

    const body = createExamSchema.parse(await req.json());
    const schoolId = resolveAdminSchoolScope(user, null);
    const scoped = await assertExamScopeContext(schoolId, {
      academicYearId: body.academicYearId,
      classId: body.classId,
      subject: body.subject,
    });

    const exam = await prisma.exam.create({
      data: {
        title: body.title,
        subject: body.subject,
        grade: body.grade,
        schoolId,
        academicYearId: scoped.academicYearId ?? null,
        classId: scoped.classId ?? null,
        createdBy: user.id,
        moeStandards: body.moeStandards,
        timeLimit: body.timeLimit,
        passingScore: body.passingScore,
        questions: {
          create: buildExamQuestionCreates(body.questions),
        },
      },
    });

    await logAudit({
      userId: user.id,
      schoolId,
      action: "exam.created",
      resourceType: "exam",
      resourceId: exam.id,
      details: {
        title: exam.title,
        subject: exam.subject,
        grade: exam.grade,
        academicYearId: exam.academicYearId,
        classId: exam.classId,
        questionCount: body.questions.length,
      },
    });

    return NextResponse.json({ exam }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
