import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { handleApiError } from "@/lib/errors/apiErrorHandler";
import { isMoeDistrictRole, isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    const isNational = user.isPlatformAdmin || isMoeSuperRole(user.role);
    if (!isNational && !isMoeDistrictRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const districtId =
      !isNational && user.schoolId
        ? (await prisma.school.findUnique({ where: { id: user.schoolId }, select: { districtId: true } }))?.districtId ?? null
        : null;

    const logs = await prisma.interventionLog.findMany({
      where: districtId ? { districtId } : {},
      select: {
        districtId: true,
        growthRiskFlag: true,
        outcomeDelta: true,
        outcomeEffectSize: true,
        generatedAt: true,
      },
    });

    const districtMap: Record<string, {
      districtId: string;
      count: number;
      riskFlags: Record<string, number>;
      outcomeDeltaSum: number;
      outcomeDeltaCount: number;
      outcomeEffectSizeSum: number;
      outcomeEffectSizeCount: number;
      latestAt: Date | null;
    }> = {};

    for (const log of logs) {
      const key = log.districtId ?? "unassigned";
      if (!districtMap[key]) {
        districtMap[key] = {
          districtId: key,
          count: 0,
          riskFlags: {},
          outcomeDeltaSum: 0,
          outcomeDeltaCount: 0,
          outcomeEffectSizeSum: 0,
          outcomeEffectSizeCount: 0,
          latestAt: null,
        };
      }

      const entry = districtMap[key];
      entry.count += 1;
      if (log.growthRiskFlag) {
        entry.riskFlags[log.growthRiskFlag] = (entry.riskFlags[log.growthRiskFlag] ?? 0) + 1;
      }
      if (log.outcomeDelta != null) {
        entry.outcomeDeltaSum += log.outcomeDelta;
        entry.outcomeDeltaCount += 1;
      }
      if (log.outcomeEffectSize != null) {
        entry.outcomeEffectSizeSum += log.outcomeEffectSize;
        entry.outcomeEffectSizeCount += 1;
      }
      if (entry.latestAt == null || log.generatedAt > entry.latestAt) {
        entry.latestAt = log.generatedAt;
      }
    }

    const byDistrict = Object.values(districtMap).map((district) => ({
      districtId: district.districtId,
      interventionCount: district.count,
      riskFlags: district.riskFlags,
      latestAt: district.latestAt?.toISOString() ?? null,
      avgOutcomeDelta:
        district.outcomeDeltaCount > 0
          ? Math.round((district.outcomeDeltaSum / district.outcomeDeltaCount) * 10000) / 10000
          : null,
      avgOutcomeEffectSize:
        district.outcomeEffectSizeCount > 0
          ? Math.round((district.outcomeEffectSizeSum / district.outcomeEffectSizeCount) * 10000) / 10000
          : null,
    }));

    const nationalDeltaValues = logs.flatMap((log) => (log.outcomeDelta == null ? [] : [log.outcomeDelta]));
    const nationalEffectValues = logs.flatMap((log) => (log.outcomeEffectSize == null ? [] : [log.outcomeEffectSize]));

    await logAudit({
      userId: user.id,
      action: "MOE_INTERVENTION_IMPACT_VIEW",
      resourceType: "intervention_impact",
      details: { scope: isNational ? "national" : "district", districtId },
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      national: {
        totalInterventions: logs.length,
        avgOutcomeDelta:
          nationalDeltaValues.length > 0
            ? Math.round((nationalDeltaValues.reduce((sum, value) => sum + value, 0) / nationalDeltaValues.length) * 10000) / 10000
            : null,
        avgOutcomeEffectSize:
          nationalEffectValues.length > 0
            ? Math.round((nationalEffectValues.reduce((sum, value) => sum + value, 0) / nationalEffectValues.length) * 10000) / 10000
            : null,
      },
      byDistrict,
    });
  } catch (error) {
    return handleApiError(error, { route: "/api/moe/intervention-impact", method: "GET" });
  }
}
