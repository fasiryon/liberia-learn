import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-config";
import { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "STUDENT") {
      return NextResponse.json({ error: "Only students can submit" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const homeworkId = body?.homeworkId as string | undefined;
    const contentRaw = body?.content as unknown;

    if (!homeworkId) return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });
    const content = typeof contentRaw === "string" ? contentRaw.trim() : "";
    if (!content) return NextResponse.json({ error: "content is required" }, { status: 400 });

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

    const hw = await prisma.homework.findUnique({
      where: { id: homeworkId },
      select: { id: true, dueAt: true, classId: true },
    });
    if (!hw) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

    const now = new Date();
    const isLate = !!hw.dueAt && now.getTime() > new Date(hw.dueAt).getTime();
    const hasLate = (Prisma as any)?.HomeworkSubmissionStatus?.LATE === "LATE";
    const status = (isLate && hasLate ? "LATE" : "SUBMITTED") as any;

    const existing = await prisma.homeworkSubmission.findFirst({
      where: { homeworkId, studentId: student.id },
      select: { id: true, status: true },
    });

    if (existing?.status === "GRADED") {
      return NextResponse.json(
        { error: "Submission already graded. Resubmission not allowed." },
        { status: 409 }
      );
    }

    const submission = existing
      ? await prisma.homeworkSubmission.update({
          where: { id: existing.id },
          data: {
            content,
            status,
            score: null,
            feedback: null,
            gradedAt: null,
            gradedById: null,
          },
        })
      : await prisma.homeworkSubmission.create({
          data: {
            homeworkId,
            studentId: student.id,
            content,
            status,
          },
        });

    return NextResponse.json({ submission });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}
