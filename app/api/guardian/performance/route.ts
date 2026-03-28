import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStudentPerformanceSummary } from "@/lib/intelligence/performanceAggregator";
import { isConfusionDetectionEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isConfusionDetectionEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "GUARDIAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!user.schoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const link = await prisma.studentGuardian.findFirst({
      where: { guardianId: user.id },
      select: { studentId: true },
    });
    if (!link) {
      return NextResponse.json({ error: "No linked student found" }, { status: 404 });
    }

    const summary = await getStudentPerformanceSummary(link.studentId, user.schoolId);
    const hasSuggestedSupport =
      (await (prisma as any).interventionRecommendation.count({
        where: {
          studentId: link.studentId,
          schoolId: user.schoolId,
          status: "pending",
          recommendationType: "guardian_support",
        },
      })) > 0;

    return NextResponse.json({
      avgScore: summary.avgScore,
      masteryLevel: summary.masteryLevel,
      improvementTrend: summary.improvementTrend,
      hasSuggestedSupport,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load guardian performance summary" },
      { status: error?.status ?? 500 }
    );
  }
}
