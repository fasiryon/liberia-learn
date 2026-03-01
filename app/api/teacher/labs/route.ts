import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVirtualLabsEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

/**
 * GET /api/teacher/labs?subject=&grade=
 * Part 7: List published virtual labs accessible to this school.
 */
export async function GET(req: NextRequest) {
  if (!isVirtualLabsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject") ?? undefined;
    const gradeStr = searchParams.get("grade");
    const grade = gradeStr ? parseInt(gradeStr, 10) : undefined;

    const labs = await prisma.virtualLab.findMany({
      where: {
        status: "published",
        OR: [{ schoolId: null }, { schoolId: user.schoolId! }],
        ...(subject ? { subject } : {}),
        ...(grade != null ? { grade } : {}),
      },
      select: {
        id: true,
        labId: true,
        title: true,
        description: true,
        subject: true,
        grade: true,
        gradeBand: true,
        labType: true,
        estimatedMinutes: true,
        difficulty: true,
        moeStandardCodes: true,
        triggerStandardCodes: true,
      },
      orderBy: [{ subject: "asc" }, { grade: "asc" }],
    });

    return NextResponse.json({ labs });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to list labs" },
      { status: err?.status ?? 500 }
    );
  }
}
