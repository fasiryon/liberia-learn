import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getApprovalSLAAnalytics } from "@/lib/autonomous/actions/approvalSLAService";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const schoolId = user.isPlatformAdmin ? null : user.schoolId;
    const where: any = {};
    if (schoolId) where.schoolId = schoolId;
    const [actions, traces, approvals] = await Promise.all([
      (prisma as any).actionExecution.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
      (prisma as any).executionTrace.findMany({ where: schoolId ? { schoolId } : {}, orderBy: { startedAt: "desc" }, take: 500 }),
      getApprovalSLAAnalytics({ schoolId }),
    ]);
    const byStatus = actions.reduce((acc: Record<string, number>, row: any) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
    const lowRiskPilots = actions.filter((row: any) => row.riskLevel === "low" && row.outputRefs?.lowRiskPilot === true).length;
    const failures = actions.filter((row: any) => row.status === "FAILED").length;
    const latencies = traces.map((row: any) => row.durationMs).filter((value: unknown): value is number => typeof value === "number");
    const averageLatencyMs = latencies.length ? Math.round(latencies.reduce((sum: number, value: number) => sum + value, 0) / latencies.length) : 0;
    return NextResponse.json({
      ok: true,
      actionCount: actions.length,
      byStatus,
      lowRiskPilots,
      failures,
      averageLatencyMs,
      approvalSLA: approvals,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load execution analytics" }, { status: error?.status ?? 500 });
  }
}

