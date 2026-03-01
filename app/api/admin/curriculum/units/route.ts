import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isUnitGroupingEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/curriculum/units
 * Part 4: Create a curriculum unit for grouping lessons.
 * Body: { name, description?, subject, grade, targetStandardCodes?, weekStart, weekEnd }
 */
export async function POST(req: NextRequest) {
  if (!isUnitGroupingEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("ADMIN");

    const body = await req.json();
    const { name, description, subject, grade, targetStandardCodes, weekStart, weekEnd } = body;

    if (!name || !subject || grade == null || weekStart == null || weekEnd == null) {
      return NextResponse.json(
        { error: "name, subject, grade, weekStart, weekEnd are required" },
        { status: 400 }
      );
    }

    if (!user.schoolId) {
      return NextResponse.json({ error: "No school context" }, { status: 400 });
    }

    const unit = await prisma.curriculumUnit.create({
      data: {
        name,
        description: description ?? undefined,
        subject,
        grade,
        schoolId: user.schoolId,
        targetStandardCodes: targetStandardCodes ?? [],
        weekStart,
        weekEnd,
        createdById: user.id,
      },
    });

    return NextResponse.json({ unit });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to create unit" },
      { status: err?.status ?? 500 }
    );
  }
}
