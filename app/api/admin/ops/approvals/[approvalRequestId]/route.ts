import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { approvalRequestId: string } }) {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    const approval = await (prisma as any).approvalRequest.findUnique({ where: { id: params.approvalRequestId } });
    if (!approval) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!user.isPlatformAdmin && approval.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const action = approval.actionExecutionId
      ? await (prisma as any).actionExecution.findUnique({ where: { id: approval.actionExecutionId } })
      : null;
    return NextResponse.json({ approval, action });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load approval" }, { status: error?.status ?? 500 });
  }
}
