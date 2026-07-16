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

    // Sprint 6.2: attach content-qa agent flags, if any, for the lessons on
    // this page — advisory only, does not affect editReviewStatus itself.
    const contentIds = lessons.map((l) => l.contentId);
    const qaReviews = contentIds.length
      ? await prisma.contentQaReview.findMany({
          where: { submissionType: "lesson", submissionId: { in: contentIds } },
          orderBy: { createdAt: "desc" },
          select: { id: true, submissionId: true, score: true, confidence: true, feedback: true, status: true, createdAt: true },
        })
      : [];
    const qaReviewsByContentId = new Map<string, typeof qaReviews>();
    for (const review of qaReviews) {
      const list = qaReviewsByContentId.get(review.submissionId) ?? [];
      list.push(review);
      qaReviewsByContentId.set(review.submissionId, list);
    }
    const lessonsWithQa = lessons.map((lesson) => ({
      ...lesson,
      qaReviews: qaReviewsByContentId.get(lesson.contentId) ?? [],
    }));

    return NextResponse.json({ lessons: lessonsWithQa, pendingCount });
  } catch (error) {
    return handleApiError(error, { route: "/api/admin/content-review", method: "GET", requestId: traceId });
  }
}
