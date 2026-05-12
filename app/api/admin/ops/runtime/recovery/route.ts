import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { runWorkflowRecovery } from "@/lib/autonomous/runtime/workflowRecoveryService";
import { getWorkerStatus, releaseExpiredLocks } from "@/lib/autonomous/runtime/autonomousWorkerService";
import { isRuntimeDashboardEnabled, isWorkflowRecoveryCronEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isRuntimeDashboardEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const workerStatus = await getWorkerStatus({ schoolId: user.isPlatformAdmin ? null : user.schoolId });
    return NextResponse.json({ ok: true, workerStatus, recoveryEnabled: isWorkflowRecoveryCronEnabled() });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load recovery status" }, { status: error?.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isRuntimeDashboardEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "recover");

    if (action === "release_locks") {
      const result = await releaseExpiredLocks({ dryRun: body?.dryRun === true });
      return NextResponse.json({ ok: true, ...result });
    }

    if (!isWorkflowRecoveryCronEnabled()) {
      return NextResponse.json({ error: "Workflow recovery cron not enabled" }, { status: 409 });
    }
    const result = await runWorkflowRecovery({ dryRun: body?.dryRun === true });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Recovery failed" }, { status: error?.status ?? 500 });
  }
}
