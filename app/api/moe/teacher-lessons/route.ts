import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { withRedisCache } from "@/lib/cache/redisCache";
import { isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

export async function GET(_req?: Request) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin && !isMoeSuperRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await withRedisCache("moe:teacher-lessons", 1800, async () => {
      const [totalPublished, bySchoolRaw, schools, topAssignedRaw] = await Promise.all([
        prisma.curriculumContent.count({
          where: { teacherCreated: true, editReviewStatus: "APPROVED" },
        }),
        prisma.curriculumContent.groupBy({
          by: ["schoolId"],
          where: { teacherCreated: true, editReviewStatus: "APPROVED", schoolId: { not: null } },
          _count: { id: true },
        }),
        prisma.school.findMany({ select: { id: true, name: true } }),
        prisma.teacherLessonAssignment.groupBy({
          by: ["contentId"],
          where: { content: { editReviewStatus: "APPROVED" } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 5,
        }),
      ]);

      const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

      const topContentIds = topAssignedRaw.map((row) => row.contentId);
      const topContents = topContentIds.length
        ? await prisma.curriculumContent.findMany({
            where: { contentId: { in: topContentIds } },
            select: {
              contentId: true,
              title: true,
              subject: true,
              grade: true,
              editedBy: { select: { name: true } },
            },
          })
        : [];
      const contentMap = new Map(topContents.map((c) => [c.contentId, c]));

      return {
        totalPublished,
        bySchool: bySchoolRaw.map((row) => ({
          schoolId: row.schoolId,
          schoolName: schoolMap.get(row.schoolId ?? "") ?? row.schoolId ?? "Unknown",
          lessonCount: row._count.id,
        })),
        topAssigned: topAssignedRaw.map((row) => {
          const c = contentMap.get(row.contentId);
          return {
            contentId: row.contentId,
            title: c?.title ?? row.contentId,
            subject: c?.subject ?? null,
            grade: c?.grade ?? null,
            teacherAuthorName: c?.editedBy?.name ?? null,
            assignmentCount: row._count.id,
          };
        }),
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/teacher-lessons", method: "GET", requestId: "moe-tl" });
  }
}
