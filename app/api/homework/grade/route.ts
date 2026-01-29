import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-config";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isTeacher = user.role === "TEACHER";
    const isAdmin = user.role === "ADMIN";

    if (!isTeacher && !isAdmin) {
      return NextResponse.json({ error: "Only teachers/admins can grade" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const submissionId = body?.submissionId as string | undefined;
    const scoreRaw = body?.score as unknown;
    const feedbackRaw = body?.feedback as unknown;

    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
    }

    const score =
      typeof scoreRaw === "number" && Number.isFinite(scoreRaw) ? scoreRaw : undefined;

    if (score !== undefined && (score < 0 || score > 100)) {
      return NextResponse.json({ error: "score must be between 0 and 100" }, { status: 400 });
    }

    const feedback = typeof feedbackRaw === "string" ? feedbackRaw : undefined;

    const sub = await prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        homeworkId: true,
        homework: { select: { classId: true } },
      },
    });

    if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    if (!sub.homework) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

    if (isTeacher) {
      const cls = await prisma.class.findUnique({
        where: { id: sub.homework.classId },
        select: { teacherId: true },
      });
      if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });
      if (cls.teacherId !== user.id) return NextResponse.json({ error: "Not your class" }, { status: 403 });
    }

    const updated = await prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        score: score ?? null,
        feedback: feedback ?? null,
        status: "GRADED",
        gradedAt: new Date(),
        gradedById: user.id,
      },
    });

    return NextResponse.json({ submission: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}
