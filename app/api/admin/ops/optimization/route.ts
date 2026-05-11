import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isAutonomousOptimizationEnabled } from "@/lib/serverFlags";
import { generateOptimizationRecommendations } from "@/lib/autonomous/optimization/optimizationEngine";
import { getGovernanceOptimizationReport } from "@/lib/autonomous/optimization/governanceReviewReportService";

export const dynamic = "force-dynamic";

function canAccess(user: any) {
  return user.isPlatformAdmin || user.role === "ADMIN" || user.role === "MOE_OFFICIAL" || user.role === "MOE_SUPER_ADMIN" || user.role === "DISTRICT_ADMIN";
}

export async function GET() {
  try {
    if (!isAutonomousOptimizationEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!canAccess(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const schoolId = user.isPlatformAdmin || String(user.role).startsWith("MOE") || user.role === "DISTRICT_ADMIN" ? null : user.schoolId;
    const report = await getGovernanceOptimizationReport({
      requester: user,
      schoolId,
      aggregateOnly: String(user.role).startsWith("MOE") || user.role === "DISTRICT_ADMIN",
    });
    return NextResponse.json({ ok: true, ...report });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load optimization report" }, { status: error?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAutonomousOptimizationEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const schoolId = user.isPlatformAdmin ? body.schoolId ?? null : user.schoolId;
    const result = await generateOptimizationRecommendations({
      schoolId,
      districtId: body.districtId ?? null,
      detectorId: body.detectorId ?? null,
      persist: body.persist !== false,
      actorId: user.id,
      isReplay: body.isReplay === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to generate optimization recommendations" }, { status: error?.status ?? 500 });
  }
}
