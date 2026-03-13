import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { withRequestLogging } from "@/lib/logging/requestLogger";

export const dynamic = "force-dynamic";

function confidenceToScore(value: unknown) {
  if (value === "high") return 90;
  if (value === "medium") return 70;
  if (value === "low") return 50;
  return null;
}

async function placementsGET() {
  if (!isMoePortalEnabled()) {
    return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
  }

  const user = await requireUser();
  if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const placements = await prisma.placementTest.findMany({
    include: {
      student: {
        include: {
          user: {
            select: {
              schoolId: true,
            },
          },
        },
      },
    },
  });

  const schools = await prisma.school.findMany({
    select: {
      id: true,
      districtId: true,
      district: true,
      District: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const schoolMap = new Map(
    schools.map((school) => [
      school.id,
      {
        districtId: school.districtId ?? school.District?.id ?? "unassigned",
        districtName: school.District?.name ?? school.district ?? "Unassigned",
      },
    ])
  );

  const districtRollups = new Map<
    string,
    {
      districtId: string;
      districtName: string;
      studentsPlaced: number;
      reviewedCount: number;
      overriddenCount: number;
      confidenceScores: number[];
      overrideReasons: string[];
    }
  >();
  const bandCounts = new Map<string, number>();

  for (const placement of placements) {
    bandCounts.set(placement.band, (bandCounts.get(placement.band) ?? 0) + 1);

    const schoolId = placement.student.user.schoolId ?? "unassigned";
    const district = schoolMap.get(schoolId) ?? { districtId: "unassigned", districtName: "Unassigned" };
    const confidence = confidenceToScore((placement.details as Record<string, unknown> | null)?.confidence);
    const entry =
      districtRollups.get(district.districtId) ??
      {
        districtId: district.districtId,
        districtName: district.districtName,
        studentsPlaced: 0,
        reviewedCount: 0,
        overriddenCount: 0,
        confidenceScores: [],
        overrideReasons: [],
      };

    entry.studentsPlaced += 1;
    if (placement.teacherDecision) entry.reviewedCount += 1;
    if (placement.teacherDecision === "overridden") entry.overriddenCount += 1;
    if (typeof confidence === "number") entry.confidenceScores.push(confidence);
    if (placement.teacherReason) entry.overrideReasons.push(placement.teacherReason);

    districtRollups.set(district.districtId, entry);
  }

  const byDistrict = Array.from(districtRollups.values()).map((entry) => {
    const overrideRate = entry.reviewedCount > 0 ? Math.round((entry.overriddenCount / entry.reviewedCount) * 100) : 0;
    const reasonCounts = new Map<string, number>();
    for (const reason of entry.overrideReasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    const topOverrideReason =
      Array.from(reasonCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

    return {
      districtId: entry.districtId,
      districtName: entry.districtName,
      studentsPlaced: entry.studentsPlaced,
      reviewedCount: entry.reviewedCount,
      overrideRate,
      avgAiConfidence:
        entry.confidenceScores.length > 0
          ? Math.round(
              entry.confidenceScores.reduce((sum, value) => sum + value, 0) / entry.confidenceScores.length
            )
          : null,
      topOverrideReason,
      warning: overrideRate > 30 ? `AI may need recalibration for ${entry.districtName}` : null,
    };
  });

  const totalReviewed = byDistrict.reduce((sum, district) => sum + district.reviewedCount, 0);
  const totalOverridden = Array.from(districtRollups.values()).reduce((sum, district) => sum + district.overriddenCount, 0);
  const confidenceRows = byDistrict.filter((district) => typeof district.avgAiConfidence === "number");
  const averageAiConfidence =
    confidenceRows.length > 0
      ? Math.round(
          confidenceRows.reduce((sum, district) => sum + (district.avgAiConfidence ?? 0), 0) / confidenceRows.length
        )
      : null;
  const mostCommonPlacementBand =
    Array.from(bandCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

  await logAudit({
    userId: user.id,
    action: "MOE_PLACEMENT_ANALYTICS_VIEW",
    resourceType: "national_placement_analytics",
  });

  return NextResponse.json({
    totalStudentsPlaced: placements.length,
    averageAiConfidence,
    nationalOverrideRate: totalReviewed > 0 ? Math.round((totalOverridden / totalReviewed) * 100) : 0,
    mostCommonPlacementBand,
    byDistrict,
  });
}

export const GET = withRequestLogging("/api/moe/placements", placementsGET);
