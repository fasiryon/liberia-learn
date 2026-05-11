import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { escalateApproval } from "@/lib/autonomous/actions/escalationService";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { approvalRequestId: string } }) {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const approval = await (prisma as any).approvalRequest.findUnique({ where: { id: params.approvalRequestId } });
    if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    if (!user.isPlatformAdmin && approval.schoolId !== user.schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const updated = await escalateApproval({ approvalRequestId: approval.id, actorId: user.id, reason: body?.reason ?? "operator_escalation" });
    return NextResponse.json({ ok: true, approvalRequestId: updated.id, approverRole: updated.approverRole });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to escalate approval" }, { status: error?.status ?? 500 });
  }
}

