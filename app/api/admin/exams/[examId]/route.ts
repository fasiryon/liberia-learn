import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isExamSystemEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

const UpdateStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
});

async function getScopedExam(examId: string, schoolId: string | null | undefined) {
  return prisma.exam.findFirst({
    where: { id: examId, schoolId: schoolId ?? undefined },
    include: { questions: true, _count: { select: { attempts: true, questions: true } } },
  });
}

export async function GET(_req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("ADMIN", "TEACHER");
    const exam = await getScopedExam(context.params.examId, user.schoolId);
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      exam: {
        ...exam,
        questionCount: exam._count.questions,
        attemptCount: exam._count.attempts,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest, context: { params: { examId: string } }) {
  try {
    if (!isExamSystemEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireRole("ADMIN");
    const exam = await prisma.exam.findFirst({
      where: { id: context.params.examId, schoolId: user.schoolId ?? undefined },
      select: { id: true },
    });
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = UpdateStatusSchema.parse(await req.json());
    const updated = await prisma.exam.update({
      where: { id: exam.id },
      data: { status: body.status },
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

    const user = await requireRole("ADMIN");
    const exam = await prisma.exam.findFirst({
      where: { id: context.params.examId, schoolId: user.schoolId ?? undefined },
      select: { id: true, status: true },
    });
    if (!exam) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (exam.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft exams can be deleted" }, { status: 400 });
    }

    await prisma.exam.delete({ where: { id: exam.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
