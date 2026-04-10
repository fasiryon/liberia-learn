import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isExamSystemEnabled } from "@/lib/serverFlags";
import { resolveAdminSchoolScope } from "@/lib/records/systemOfRecord";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, context: { params: { examId: string } }) {
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
      select: { id: true, title: true, publishedAt: true, _count: { select: { questions: true } } },
    });
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (exam._count.questions < 5) {
      return NextResponse.json({ error: "Exam must contain at least 5 questions before publishing" }, { status: 400 });
    }

    await prisma.exam.update({
      where: { id: exam.id },
      data: {
        status: "PUBLISHED",
        publishedAt: exam.publishedAt ?? new Date(),
      },
    });

    await logAudit({
      userId: user.id,
      schoolId,
      action: "exam.published",
      resourceType: "exam",
      resourceId: exam.id,
      details: { title: exam.title, questionCount: exam._count.questions },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
