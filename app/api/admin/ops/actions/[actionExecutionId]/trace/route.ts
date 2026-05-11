import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { actionExecutionId: string } }) {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    const action = await (prisma as any).actionExecution.findUnique({ where: { id: params.actionExecutionId } });
    if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!user.isPlatformAdmin && action.schoolId !== user.schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [approval, traces, steps] = await Promise.all([
      action.approvalRequestId ? (prisma as any).approvalRequest.findUnique({ where: { id: action.approvalRequestId } }) : null,
      (prisma as any).executionTrace.findMany({ where: { workflowRunId: action.workflowRunId }, orderBy: { startedAt: "asc" } }),
      (prisma as any).workflowStep.findMany({ where: { workflowRunId: action.workflowRunId }, orderBy: { sequence: "asc" } }),
    ]);
    return NextResponse.json({ action, approval, traces, steps });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load action trace" }, { status: error?.status ?? 500 });
  }
}
