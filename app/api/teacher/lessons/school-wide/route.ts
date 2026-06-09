import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export async function GET() {
  try {
    const user = await requireRole("TEACHER");
    if (!user.schoolId) return NextResponse.json({ lessons: [] });

    const lessons = await prisma.curriculumContent.findMany({
      where: {
        visibility: "school_wide",
        schoolId: user.schoolId,
        editReviewStatus: "APPROVED",
        editedById: { not: user.id },
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: {
        id: true,
        contentId: true,
        title: true,
        grade: true,
        subject: true,
        lessonVersion: true,
        editedBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    return handleApiError(error, { route: "/api/teacher/lessons/school-wide", method: "GET", requestId: "sw" });
  }
}
