import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("ADMIN");
    const exam = await prisma.exam.findFirst({
      where: { id: context.params.examId, schoolId: user.schoolId ?? undefined },
      select: { id: true, title: true, _count: { select: { questions: true } } },
    });
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (exam._count.questions < 5) {
      return NextResponse.json({ error: "Exam must contain at least 5 questions before publishing" }, { status: 400 });
    }

    await prisma.exam.update({
      where: { id: exam.id },
      data: { status: "PUBLISHED" },
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
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
