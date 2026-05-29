/**
 * GET /api/adaptive/mastery
 *
 * Returns the student's AdaptiveMasteryRecord list for progress display.
 * Optionally filtered by subject or grade.
 *
 * Auth: STUDENT role required
 *
 * Query params:
 *   ?subject=MATH        filter by subject prefix in skillKey
 *   ?grade=5             filter by grade in skillKey
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRole("STUDENT");

    const { searchParams } = new URL(req.url);
    const subjectFilter = searchParams.get("subject");
    const gradeFilter = searchParams.get("grade");

    const student = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ error: "student_not_found" }, { status: 404 });
    }

    const records = await prisma.adaptiveMasteryRecord.findMany({
      where: { studentId: student.id },
      select: {
        skillKey: true,
        score: true,
        consecutiveCorrect: true,
        masteredAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Apply optional client-side filters on skillKey prefix
    const filtered = records.filter((r) => {
      if (subjectFilter && !r.skillKey.startsWith(subjectFilter + ":")) return false;
      if (gradeFilter && !r.skillKey.includes(`:G${gradeFilter}:`)) return false;
      return true;
    });

    const masteredCount = filtered.filter((r) => r.masteredAt !== null).length;

    return NextResponse.json({
      records: filtered,
      total: filtered.length,
      masteredCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "mastery_fetch_failed" },
      { status: error?.status ?? 500 }
    );
  }
}
