import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { withRedisCache } from "@/lib/cache/redisCache";

export const dynamic = "force-dynamic";

export async function GET(_req?: Request) {
  try {
    await requireRole("MOE_OFFICIAL");

    const data = await withRedisCache("moe:teacher-lessons", 1800, async () => {
      const [totalPublished, bySchoolRaw, schools] = await Promise.all([
        prisma.curriculumContent.count({
          where: { teacherCreated: true, editReviewStatus: "APPROVED" },
        }),
        prisma.curriculumContent.groupBy({
          by: ["schoolId"],
          where: { teacherCreated: true, editReviewStatus: "APPROVED", schoolId: { not: null } },
          _count: { id: true },
        }),
        prisma.school.findMany({ select: { id: true, name: true } }),
      ]);

      const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

      return {
        totalPublished,
        bySchool: bySchoolRaw.map((row) => ({
          schoolId: row.schoolId,
          schoolName: schoolMap.get(row.schoolId ?? "") ?? row.schoolId ?? "Unknown",
          lessonCount: row._count.id,
        })),
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/teacher-lessons", method: "GET", requestId: "moe-tl" });
  }
}
