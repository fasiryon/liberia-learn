import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlacementReviewStatus } from "@/lib/placement";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    if (!user.schoolId) {
      return NextResponse.json({ error: "School context required" }, { status: 400 });
    }

    const placements = await prisma.placementTest.findMany({
      where: {
        student: {
          user: {
            schoolId: user.schoolId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const rows = placements.map((placement) => ({
      id: placement.id,
      studentId: placement.studentId,
      studentName: placement.student.user.name ?? placement.student.user.email ?? "Student",
      currentGrade: placement.student.currentGrade,
      testDate: placement.createdAt.toISOString(),
      recommendedGrade: placement.estimatedGrade,
      band: placement.band,
      levelLabel: placement.levelLabel,
      status: getPlacementReviewStatus(placement.teacherDecision),
      teacherDecision: placement.teacherDecision,
      teacherGrade: placement.teacherGrade,
      teacherReason: placement.teacherReason,
    }));

    const summary = {
      totalTested: rows.length,
      pendingReview: rows.filter((row) => row.status === "pending").length,
      confirmed: rows.filter((row) => row.status === "confirmed").length,
      overridden: rows.filter((row) => row.status === "overridden").length,
    };

    return NextResponse.json({ summary, placements: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: err?.status ?? 500 });
  }
}
