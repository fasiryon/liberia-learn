import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export async function GET(_req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("TEACHER");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const shares = await prisma.lessonShare.findMany({
      where: { schoolId: user.schoolId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        sharedBy: { select: { id: true, name: true } },
        lesson: {
          select: {
            id: true,
            contentId: true,
            title: true,
            grade: true,
            subject: true,
            status: true,
            editReviewStatus: true,
          },
        },
      },
    });

    return NextResponse.json({
      lessons: shares.map((s) => ({
        shareId: s.id,
        sharedAt: s.createdAt,
        sharedByName: s.sharedBy.name,
        ...s.lesson,
      })),
    });
  } catch (error) {
    return handleApiError(error, {
      route: "/api/teacher/lessons/shared",
      method: "GET",
      requestId: traceId,
    });
  }
}
