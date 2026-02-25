/**
 * GET /api/admin/dashboard/school/impact
 *
 * School-level impact analytics: proficiency rate, mastery delta, growth delta,
 * effect size, statistical meaningfulness, teacher effect signals (hashed).
 *
 * Feature flag : ENABLE_IMPACT_ANALYTICS (default OFF → 404)
 * Auth         : ADMIN role + DASHBOARD_SCHOOL_IMPACT permission
 *                Platform admins may query any school via ?schoolId=
 * Tenant scope : Non-platform admins are hard-scoped to their own schoolId
 *
 * Params:
 *   from=YYYY-MM        (required) period start
 *   to=YYYY-MM          (required) period end
 *   scope=school|class  (optional, default "school")
 *   classId=<id>        (required when scope=class; must belong to admin's school)
 *   schoolId=<id>       (platform admin only)
 *
 * Audit action : "dashboard.impact.school.viewed"
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { assertPermission, PERMISSIONS } from "@/lib/permissions";
import { isImpactAnalyticsEnabled, isImpactSnapshotsEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { computeImpact, isValidPeriod } from "@/lib/metrics/impact/impactEngine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isImpactAnalyticsEnabled()) {
      return NextResponse.json({ error: "impact_analytics_disabled" }, { status: 404 });
    }

    const user = await requireRole("ADMIN");
    assertPermission(user, PERMISSIONS.DASHBOARD_SCHOOL_IMPACT);

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    const scope = searchParams.get("scope") ?? "school";
    const classIdParam = searchParams.get("classId") ?? null;

    if (!isValidPeriod(from) || !isValidPeriod(to)) {
      return NextResponse.json(
        { error: "from and to must be YYYY-MM format" },
        { status: 400 }
      );
    }
    if (from > to) {
      return NextResponse.json({ error: "from must be <= to" }, { status: 400 });
    }

    // Tenant isolation: non-platform admins always scoped to their schoolId
    const effectiveSchoolId = user.isPlatformAdmin
      ? (searchParams.get("schoolId") ?? user.schoolId ?? null)
      : (user.schoolId ?? null);

    if (!effectiveSchoolId) {
      return NextResponse.json({ error: "schoolId required" }, { status: 400 });
    }

    const classId = scope === "class" ? classIdParam : null;
    if (scope === "class" && !classId) {
      return NextResponse.json({ error: "classId required when scope=class" }, { status: 400 });
    }

    const result = await computeImpact({
      tenantId: effectiveSchoolId,
      schoolId: effectiveSchoolId,
      classId,
      periodRange: { from, to },
    });

    // ── Optional snapshot storage (flag-gated) ─────────────────────────────
    if (isImpactSnapshotsEnabled()) {
      await (prisma as any).impactSnapshot.create({
        data: {
          tenantId: effectiveSchoolId,
          schoolId: effectiveSchoolId,
          classId: classId ?? null,
          period: to,
          proficiencyRate: result.proficiencyRate,
          avgMasteryScore: result.avgMasteryScore,
          masteryDelta: result.masteryDelta,
          growthDelta: result.growthDelta,
          effectSize: result.effectSize ?? null,
          statisticallyMeaningful: result.statisticallyMeaningful,
          confidenceLabel: result.confidenceLabel,
          sampleSize: result.sampleSize,
        },
      });
    }

    await logAudit({
      userId: user.id,
      action: "dashboard.impact.school.viewed",
      resourceType: "impact_analytics",
      resourceId: effectiveSchoolId,
      schoolId: user.schoolId,
      traceId,
      details: {
        from,
        to,
        scope,
        sampleSize: result.sampleSize,
        statisticallyMeaningful: result.statisticallyMeaningful,
        // No student IDs
      },
    });

    return NextResponse.json({
      ...result,
      period: { from, to },
      scope,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}
