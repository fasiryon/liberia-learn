/**
 * GET /api/admin/dashboard/school/intervention-outcomes
 *
 * School-level intervention outcome rollups (aggregate only).
 * Feature flag : ENABLE_INTERVENTION_OUTCOMES (default OFF -> 404)
 * Auth         : ADMIN or DISTRICT_ADMIN + VIEW_SCHOOL_DASHBOARD
 * Tenant scope : Non-platform admins are hard-scoped to their own schoolId
 *
 * Audit action : "interventions.outcomes.school.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isInterventionOutcomesEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { prisma } from "@/lib/db";
import { mean } from "@/lib/metrics/impact/statRules";

export const dynamic = "force-dynamic";

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function effectSizeBand(effectSize: number | null): "small" | "medium" | "large" | null {
  if (effectSize == null) return null;
  const abs = Math.abs(effectSize);
  if (abs >= 0.8) return "large";
  if (abs >= 0.5) return "medium";
  if (abs >= 0.2) return "small";
  return null;
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isInterventionOutcomesEnabled()) {
      return NextResponse.json({ error: "intervention_outcomes_disabled" }, { status: 404 });
    }

    const user = await requireRole("ADMIN", "DISTRICT_ADMIN");
    assertPermission(user, PERMISSIONS.VIEW_SCHOOL_DASHBOARD);

    const { searchParams } = new URL(req.url);
    const requestedSchoolId = searchParams.get("schoolId");

    if (!user.isPlatformAdmin && requestedSchoolId && requestedSchoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const effectiveSchoolId = user.isPlatformAdmin
      ? (requestedSchoolId ?? user.schoolId ?? null)
      : (user.schoolId ?? null);

    if (!effectiveSchoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const logs = await prisma.interventionLog.findMany({
      where: { schoolId: effectiveSchoolId },
      select: {
        outcomeCheckedAt: true,
        outcomeDelta: true,
        outcomeEffectSize: true,
      },
    });

    const totalInterventions = logs.length;
    const resolved = logs.filter((l) => l.outcomeCheckedAt);
    const resolvedCount = resolved.length;
    const percentResolved = totalInterventions
      ? round1((resolvedCount / totalInterventions) * 100)
      : 0;

    const deltas = resolved
      .map((l) => l.outcomeDelta)
      .filter((v): v is number => typeof v === "number");
    const avgDelta = deltas.length ? round4(mean(deltas)) : 0;
    const avgDeltaPercent = deltas.length ? round1(avgDelta * 100) : 0;

    const effectSizes = resolved
      .map((l) => l.outcomeEffectSize)
      .filter((v): v is number => typeof v === "number");
    const avgEffectSize = effectSizes.length ? round4(mean(effectSizes)) : null;
    const effectBand = effectSizeBand(avgEffectSize);

    const impactSummary =
      resolvedCount === 0
        ? "No resolved intervention outcomes yet."
        : avgDelta >= 0
          ? `Interventions led to ${avgDeltaPercent}% mastery improvement.`
          : `Interventions led to ${Math.abs(avgDeltaPercent)}% mastery decline.`;

    await logAudit({
      userId: user.id,
      action: "interventions.outcomes.school.viewed",
      resourceType: "intervention_outcomes",
      resourceId: effectiveSchoolId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        totalInterventions,
        resolvedCount,
        avgDelta,
      },
    });

    recordMetricEvent(
      "intervention_outcomes_viewed",
      { totalInterventions, resolvedCount },
      { scope: "school", scopeId: effectiveSchoolId, schoolId: effectiveSchoolId }
    ).catch(() => {});

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      schoolId: effectiveSchoolId,
      summary: {
        totalInterventions,
        percentResolved,
        avgDelta,
        avgDeltaPercent,
        avgEffectSize,
        effectSizeBand: effectBand,
        impactSummary,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}

