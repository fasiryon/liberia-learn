import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { processStaleApprovals } from "@/lib/autonomous/actions/staleApprovalWorker";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const result = await processStaleApprovals({
      schoolId: user.isPlatformAdmin ? null : user.schoolId,
      dryRun: body?.dryRun === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to process stale approvals" }, { status: error?.status ?? 500 });
  }
}

