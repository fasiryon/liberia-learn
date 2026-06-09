import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export async function GET(req: NextRequest) {
  try {
    await requireRole("TEACHER");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const subject = searchParams.get("subject") ?? undefined;
    const gradeParam = searchParams.get("grade");
    const grade = gradeParam ? Number(gradeParam) : undefined;

    const lessons = await prisma.curriculumContent.findMany({
      where: {
        teacherCreated: false,
        editReviewStatus: "APPROVED",
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
        ...(subject ? { subject } : {}),
        ...(grade ? { grade } : {}),
      },
      orderBy: { title: "asc" },
      take: 20,
      select: { id: true, contentId: true, title: true, grade: true, subject: true },
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    return handleApiError(error, {
      route: "/api/teacher/lessons/forkable",
      method: "GET",
      requestId: "forkable",
    });
  }
}
