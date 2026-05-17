import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export async function GET(_req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("TEACHER");

    const lessons = await prisma.curriculumContent.findMany({
      where: { editedById: user.id },
      orderBy: { editedAt: "desc" },
      take: 100,
      select: {
        id: true,
        contentId: true,
        title: true,
        grade: true,
        subject: true,
        status: true,
        editReviewStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ lessons });
  } catch (error) {
    return handleApiError(error, {
      route: "/api/teacher/lessons/mine",
      method: "GET",
      requestId: traceId,
    });
  }
}
