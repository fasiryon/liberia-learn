/**
 * GET /api/admin/dashboard/school/interventions
 *
 * School-level intervention recommendations (aggregate only).
 * No student identifiers in inputs or outputs.
 *
 * Feature flag : ENABLE_AI_INTERVENTIONS (default OFF -> 404)
 * Auth         : ADMIN or DISTRICT_ADMIN + VIEW_SCHOOL_DASHBOARD
 * Tenant scope : Non-platform admins are hard-scoped to their own schoolId
 *
 * Audit action : "interventions.school.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isAiInterventionsEnabled, isAiInterventionsAiEnhanced } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { computeRecommendations } from "@/lib/ai/interventions/recommendationEngine";
import { recordIntervention } from "@/lib/ai/interventions/outcomeTracker";
import { computeSchoolDashboard } from "@/lib/reporting/dashboard/dashboardAggregator";
import { computeSchoolTrends } from "@/lib/reporting/trends/trendAggregator";
import { fetchLatestImpactSnapshot } from "@/lib/metrics/impact/impactSnapshotRepo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isAiInterventionsEnabled()) {
      return NextResponse.json({ error: "ai_interventions_disabled" }, { status: 404 });
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

    const currentMetrics = await computeSchoolDashboard({
      tenantId: effectiveSchoolId,
      schoolId: effectiveSchoolId,
    });

    const trends = await computeSchoolTrends({
      tenantId: effectiveSchoolId,
      schoolId: effectiveSchoolId,
      period: "monthly",
      lookbackMonths: 6,
    });

    const impactData = await fetchLatestImpactSnapshot({
      tenantId: effectiveSchoolId,
      schoolId: effectiveSchoolId,
    });

    const result = await computeRecommendations({
      tenantId: effectiveSchoolId,
      schoolId: effectiveSchoolId,
      currentMetrics,
      trends,
      impactData,
    });

    const aiEnhanced = isAiInterventionsAiEnhanced() && !!process.env.OPENAI_API_KEY;
    void recordIntervention({
      tenantId: effectiveSchoolId,
      schoolId: effectiveSchoolId,
      result,
      aiEnhanced,
    });

    await logAudit({
      userId: user.id,
      action: "interventions.school.viewed",
      resourceType: "interventions",
      resourceId: effectiveSchoolId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        priorityScore: result.interventionPriorityScore,
        growthRiskFlag: result.growthRiskFlag,
        actionCount: result.recommendedActions.length,
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}

