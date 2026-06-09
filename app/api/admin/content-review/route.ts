import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    const user = await requireRole("ADMIN");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "PENDING";

    const lessons = await prisma.curriculumContent.findMany({
      where: {
        editReviewStatus: status,
        editedById: { not: null },
      },
      orderBy: { editedAt: "desc" },
      take: 100,
      select: {
        id: true,
        contentId: true,
        title: true,
        grade: true,
        subject: true,
        editReviewStatus: true,
        editedAt: true,
        publishedAt: true,
        rejectionReason: true,
        learningObjectives: true,
        editedBy: {
          select: { id: true, name: true, schoolId: true, school: { select: { name: true } } },
        },
      },
    });

    const pendingCount = await prisma.curriculumContent.count({
      where: { editReviewStatus: "PENDING", editedById: { not: null } },
    });

    return NextResponse.json({ lessons, pendingCount });
  } catch (error) {
    return handleApiError(error, { route: "/api/admin/content-review", method: "GET", requestId: traceId });
  }
}
