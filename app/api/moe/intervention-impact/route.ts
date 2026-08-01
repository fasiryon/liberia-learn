// app/api/moe/intervention-impact/route.ts
// Block 28 — MOE Intervention Impact
// Returns aggregated intervention outcome metrics by district.
// No PII — district-level aggregates and risk flag counts only.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin && !isMoeSuperRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const logs = await prisma.interventionLog.findMany({
      select: {
        districtId: true,
        growthRiskFlag: true,
        outcomeDelta: true,
        outcomeEffectSize: true,
        generatedAt: true,
      },
    });

    // Aggregate by district
    const districtMap: Record<
      string,
      {
        districtId: string;
        count: number;
        riskFlags: Record<string, number>;
        outcomeDeltaSum: number;
        outcomeDeltaCount: number;
        outcomeEffectSizeSum: number;
        outcomeEffectSizeCount: number;
        latestAt: Date | null;
      }
    > = {};

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
      entry.count++;
      if (log.growthRiskFlag) {
        entry.riskFlags[log.growthRiskFlag] = (entry.riskFlags[log.growthRiskFlag] ?? 0) + 1;
      }
      if (log.outcomeDelta != null) {
        entry.outcomeDeltaSum += log.outcomeDelta;
        entry.outcomeDeltaCount++;
      }
      if (log.outcomeEffectSize != null) {
        entry.outcomeEffectSizeSum += log.outcomeEffectSize;
        entry.outcomeEffectSizeCount++;
      }
      if (entry.latestAt == null || log.generatedAt > entry.latestAt) {
        entry.latestAt = log.generatedAt;
      }
    }

    const byDistrict = Object.values(districtMap).map((d) => ({
      districtId: d.districtId,
      interventionCount: d.count,
      riskFlags: d.riskFlags,
      latestAt: d.latestAt?.toISOString() ?? null,
      avgOutcomeDelta:
        d.outcomeDeltaCount > 0
          ? Math.round((d.outcomeDeltaSum / d.outcomeDeltaCount) * 10000) / 10000
          : null,
      avgOutcomeEffectSize:
        d.outcomeEffectSizeCount > 0
          ? Math.round((d.outcomeEffectSizeSum / d.outcomeEffectSizeCount) * 10000) / 10000
          : null,
    }));

    // National totals
    const nationalDeltaVals = logs
      .filter((l) => l.outcomeDelta != null)
      .map((l) => l.outcomeDelta as number);
    const nationalEffectVals = logs
      .filter((l) => l.outcomeEffectSize != null)
      .map((l) => l.outcomeEffectSize as number);

    void logAudit({
      userId: user.id,
      action: "MOE_INTERVENTION_IMPACT_VIEW",
      resourceType: "intervention_impact",
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      national: {
        totalInterventions: logs.length,
        avgOutcomeDelta:
          nationalDeltaVals.length > 0
            ? Math.round(
                (nationalDeltaVals.reduce((s, v) => s + v, 0) / nationalDeltaVals.length) *
                  10000
              ) / 10000
            : null,
        avgOutcomeEffectSize:
          nationalEffectVals.length > 0
            ? Math.round(
                (nationalEffectVals.reduce((s, v) => s + v, 0) / nationalEffectVals.length) *
                  10000
              ) / 10000
            : null,
      },
      byDistrict,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
