import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-config";

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

    if (!homeworkId) {
      return NextResponse.json({ error: "homeworkId is required" }, { status: 400 });
    }

    const content = typeof contentRaw === "string" ? contentRaw : "";
    if (!content.trim()) {
      return NextResponse.json({ error: "content is required" }, { status: 400 });
    }

    // Resolve student profile
    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

    // Load homework (for due date + class)
    const hw = await prisma.homework.findUnique({
      where: { id: homeworkId },
      select: { id: true, dueAt: true, classId: true },
    });
    if (!hw) return NextResponse.json({ error: "Homework not found" }, { status: 404 });

    // (Optional) enforce enrollment (you already started this pattern in [id])
    const enrolled = await prisma.enrollment.findFirst({
      where: { classId: hw.classId, studentId: student.id },
      select: { id: true },
    });
    if (!enrolled) return NextResponse.json({ error: "Not enrolled in this class" }, { status: 403 });

    // Find existing submission for this student+homework
    const existing = await prisma.homeworkSubmission.findFirst({
      where: { homeworkId, studentId: student.id },
      select: { id: true, status: true },
      orderBy: { createdAt: "desc" },
    });

    // BLOCK overwrite if already graded
    if (existing?.status === "GRADED") {
      return NextResponse.json(
        { error: "Submission already graded. Resubmission is not allowed." },
        { status: 409 }
      );
    }

    // Due date (soft enforcement for now: allow submit, but return late flag)
    const now = new Date();
    const isLate = hw.dueAt ? now.getTime() > new Date(hw.dueAt).getTime() : false;

    // If exists (not graded) -> update; else create
    const submission = existing
      ? await prisma.homeworkSubmission.update({
          where: { id: existing.id },
          data: {
            content,
            status: "SUBMITTED",
          },
        })
      : await prisma.homeworkSubmission.create({
          data: {
            homeworkId,
            studentId: student.id,
            content,
            status: "SUBMITTED",
          },
        });

    return NextResponse.json({ submission, isLate });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed" }, { status: 500 });
  }
}