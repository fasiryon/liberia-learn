/**
 * GET /api/admin/dashboard/district/interventions
 *
 * District-level intervention recommendations across all schools.
 *
 * Feature flag : ENABLE_AI_INTERVENTIONS (default OFF -> 404)
 * Auth         : ADMIN or DISTRICT_ADMIN + VIEW_DISTRICT_DASHBOARD
 *
 * Audit action : "interventions.district.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isAiInterventionsEnabled, isAiInterventionsAiEnhanced } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { computeRecommendations } from "@/lib/ai/interventions/recommendationEngine";
import { recordIntervention } from "@/lib/ai/interventions/outcomeTracker";
import { computeSchoolDashboard } from "@/lib/reporting/dashboard/dashboardAggregator";
import { computeSchoolTrends } from "@/lib/reporting/trends/trendAggregator";
import { fetchLatestImpactSnapshot } from "@/lib/metrics/impact/impactSnapshotRepo";
import { resolveDistrictContext } from "@/lib/reporting/districtScope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isAiInterventionsEnabled()) {
      return NextResponse.json({ error: "ai_interventions_disabled" }, { status: 404 });
    }

    const user = await requireRole("ADMIN", "DISTRICT_ADMIN");
    assertPermission(user, PERMISSIONS.VIEW_DISTRICT_DASHBOARD);

    const { searchParams } = new URL(req.url);
    const { districtId, tenantId } = await resolveDistrictContext({ user, searchParams });

    const schools = await prisma.school.findMany({
      where: { districtId },
      select: { id: true },
    });

    const aiEnhanced = isAiInterventionsAiEnhanced() && !!process.env.OPENAI_API_KEY;

    const results = await Promise.all(
      schools.map(async (school) => {
        const currentMetrics = await computeSchoolDashboard({
          tenantId,
          schoolId: school.id,
        });
        const trends = await computeSchoolTrends({
          tenantId,
          schoolId: school.id,
          period: "monthly",
          lookbackMonths: 6,
        });
        const impactData = await fetchLatestImpactSnapshot({
          tenantId,
          schoolId: school.id,
        });

        const recommendation = await computeRecommendations({
          tenantId,
          schoolId: school.id,
          currentMetrics,
          trends,
          impactData,
        });

        void recordIntervention({
          tenantId,
          schoolId: school.id,
          districtId,
          result: recommendation,
          aiEnhanced,
        });

        return {
          schoolId: school.id,
          ...recommendation,
        };
      })
    );

    await logAudit({
      userId: user.id,
      action: "interventions.district.viewed",
      resourceType: "interventions",
      resourceId: districtId,
      schoolId: user.schoolId ?? null,
      traceId,
      details: {
        districtId,
        schoolCount: schools.length,
      },
    });

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}

