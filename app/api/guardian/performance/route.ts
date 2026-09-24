// route-policy: auth=session; scope=record; authority=guardian-link; rationale=a guardian sees only linked children and evidence from the child school
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

export async function GET(req?: Request) {
  try {
    if (!isGuardianProgressViewEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "GUARDIAN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const links = await prisma.studentGuardian.findMany({
      where: { guardianId: user.id },
      orderBy: { id: "asc" },
      select: {
        studentId: true,
        student: { select: { user: { select: { name: true, schoolId: true } } } },
      },
    });
    if (links.length === 0) {
      return NextResponse.json({ error: "No linked student found" }, { status: 404 });
    }

    const requestedId = req ? new URL(req.url).searchParams.get("studentId") : null;
    const link = requestedId ? links.find((l) => l.studentId === requestedId) : links[0];
    if (!link) {
      return NextResponse.json({ error: "You do not have access to this student" }, { status: 403 });
    }

    const children = links.map((l) => ({
      studentId: l.studentId,
      name: l.student?.user?.name ?? "Your child",
    }));
    const selected = {
      studentId: link.studentId,
      studentName: link.student?.user?.name ?? "Your child",
      children,
    };

    // Evidence lives in the child's school, not the guardian's account school.
    const childSchoolId = link.student?.user?.schoolId ?? null;
    const summary = childSchoolId
      ? await getStudentPerformanceSummary(link.studentId, childSchoolId)
      : null;

    await logAudit({
      userId: user.id,
      schoolId: childSchoolId ?? user.schoolId,
      action: "guardian.progress.viewed",
      resourceType: "guardian_progress",
      resourceId: link.studentId,
    });

    // No scored work yet is "not enough information", never a zero score.
    if (!summary || summary.evidenceCount === 0) {
      return NextResponse.json({ ...selected, hasEvidence: false });
    }

    const hasSuggestedSupport =
      (await (prisma as any).interventionRecommendation.count({
        where: {
          studentId: link.studentId,
          schoolId: childSchoolId,
          status: "pending",
          recommendationType: "guardian_support",
        },
      })) > 0;
    const supportSuggestions = buildSupportSuggestions({
      masteryLevel: summary.masteryLevel,
      improvementTrend: summary.improvementTrend,
      hasSuggestedSupport,
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
      ...selected,
      hasEvidence: true,
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
