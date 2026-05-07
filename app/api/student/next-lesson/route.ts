import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");
    const subjectParam = req.nextUrl.searchParams.get("subject");
    const subject = subjectParam ? subjectParam.toUpperCase() : null;

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true, currentGrade: true },
    });

    if (!student || !subject) {
      return NextResponse.json(null);
    }

    // Completed content IDs for this student
    const completedProgress = await prisma.studentProgress.findMany({
      where: { studentId: user.id, completedAt: { not: null } },
      select: { scheduledWork: { select: { contentId: true } } },
    });
    const completedContentIds = completedProgress
      .map((p) => p.scheduledWork?.contentId)
      .filter(Boolean) as string[];

    const lesson = await prisma.curriculumContent.findFirst({
      where: {
        grade: student.currentGrade ?? undefined,
        subject: { contains: subject, mode: "insensitive" },
        status: { in: ["published", "APPROVED"] },
        NOT: completedContentIds.length > 0 ? { contentId: { in: completedContentIds } } : undefined,
      },
      orderBy: [{ orderInUnit: "asc" }, { createdAt: "asc" }],
      select: { contentId: true, title: true, subject: true },
    });

    return NextResponse.json(
      lesson ? { contentId: lesson.contentId, title: lesson.title, subject: lesson.subject } : null
    );
  } catch (err: any) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
