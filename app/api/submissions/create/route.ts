import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.schoolId) {
      return NextResponse.json({ error: "User missing schoolId" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const homeworkId = body?.homeworkId as string | undefined;
    const answers = body?.answers ?? null;

    if (!homeworkId) {
      return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });
    }

    const hw = await prisma.homework.findFirst({
      where: { id: homeworkId, Class: { schoolId: user.schoolId } },
      select: { id: true },
    });

    if (!hw) {
      return NextResponse.json({ error: "Homework not found (or not in your school)" }, { status: 404 });
    }

    const subModel =
      (prisma as any).homeworkSubmission ??
      (prisma as any).submission ??
      (prisma as any).Submission ??
      null;

    if (!subModel) {
      return NextResponse.json(
        { error: "No submission model found on Prisma client. Expected homeworkSubmission or submission." },
        { status: 500 }
      );
    }

    const existing = await subModel.findFirst({
      where: { homeworkId: hw.id, studentId: user.id },
      select: { id: true },
    });

    let saved;
    if (existing) {
      saved = await subModel.update({
        where: { id: existing.id },
        data: { answers },
        select: { id: true, homeworkId: true, studentId: true, answers: true, submittedAt: true },
      });
    } else {
      saved = await subModel.create({
        data: { homeworkId: hw.id, studentId: user.id, answers },
        select: { id: true, homeworkId: true, studentId: true, answers: true, submittedAt: true },
      });
    }

    return NextResponse.json({ ok: true, submission: saved });
  } catch (e: any) {
    // IMPORTANT: surface Prisma error details
    console.error("SUBMISSION_CREATE_ERROR:", e);

    const code = e?.code ?? null;
    const meta = e?.meta ?? null;
    const name = e?.name ?? null;
    const message = e?.message ?? "Internal Server Error";

    // common Prisma cases
    if (code === "P2002") return NextResponse.json({ error: "Unique constraint (duplicate submission)", code, meta }, { status: 409 });
    if (code === "P2003") return NextResponse.json({ error: "FK constraint failed", code, meta }, { status: 400 });

    return NextResponse.json({ error: message, name, code, meta }, { status: 500 });
  }
}
