import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { getStudentPerformanceSummary } from "@/lib/intelligence/performanceAggregator";
import {
  isGuardianProgressViewEnabled,
} from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

function buildSupportSuggestions(input: {
  masteryLevel: "struggling" | "developing" | "proficient" | "advanced";
  improvementTrend: "improving" | "stable" | "declining";
  hasSuggestedSupport: boolean;
}): string[] {
  const suggestions: string[] = [];

  if (input.hasSuggestedSupport) {
    suggestions.push("Ask your child to explain one thing they learned today.");
  }
  if (input.masteryLevel === "struggling" || input.improvementTrend === "declining") {
    suggestions.push("Set aside 10 quiet minutes for review after school.");
  }
  if (input.masteryLevel === "developing" || input.improvementTrend === "stable") {
    suggestions.push("Praise steady effort, not just high scores.");
  }
  if (input.masteryLevel === "proficient" || input.masteryLevel === "advanced") {
    suggestions.push("Invite your child to teach back one idea from class.");
  }

  return suggestions.slice(0, 3);
}

export async function GET() {
  try {
    if (!isGuardianProgressViewEnabled()) {
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
    const supportSuggestions = buildSupportSuggestions({
      masteryLevel: summary.masteryLevel,
      improvementTrend: summary.improvementTrend,
      hasSuggestedSupport,
    });

    await logAudit({
      userId: user.id,
      schoolId: user.schoolId,
      action: "guardian.progress.viewed",
      resourceType: "guardian_progress",
      resourceId: link.studentId,
    });

    const doingWell =
      summary.masteryLevel === "advanced" || summary.improvementTrend === "improving"
        ? "Your child is showing positive learning momentum."
        : "Your child is building steady learning habits.";
    const needsHelp =
      summary.masteryLevel === "struggling" || summary.improvementTrend === "declining"
        ? "A little extra review at home could help this week."
        : "Keep checking in on daily practice and confidence.";

    return NextResponse.json({
      avgScore: summary.avgScore,
      masteryLevel: summary.masteryLevel,
      improvementTrend: summary.improvementTrend,
      hasSuggestedSupport,
      supportSuggestions,
      doingWell,
      needsHelp,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to load guardian performance summary" },
      { status: error?.status ?? 500 }
    );
  }
}
