import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isUnitGroupingEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/curriculum/units?grade=&subject=
 * Part 4: List curriculum units for teacher's school, with lesson count.
 */
export async function GET(req: NextRequest) {
  if (!isUnitGroupingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const grade = searchParams.get("grade") ? parseInt(searchParams.get("grade")!, 10) : undefined;
    const subject = searchParams.get("subject") ?? undefined;

    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    const units = await prisma.curriculumUnit.findMany({
      where: {
        schoolId: user.schoolId,
        ...(grade != null ? { grade } : {}),
        ...(subject ? { subject } : {}),
      },
      orderBy: [{ weekStart: "asc" }, { name: "asc" }],
    });

    // Get lesson counts for each unit via CurriculumContent.unitId
    const unitIds = units.map((u) => u.unitId);
    const lessonCounts = await prisma.curriculumContent.groupBy({
      by: ["unitId"],
      where: { unitId: { in: unitIds } },
      _count: { id: true },
    });
    const countMap = Object.fromEntries(
      lessonCounts.map((lc) => [lc.unitId!, lc._count.id])
    );

    const result = units.map((u) => ({
      ...u,
      lessonCount: countMap[u.unitId] ?? 0,
    }));

    return NextResponse.json({ units: result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to list units" },
      { status: err?.status ?? 500 }
    );
  }
}
