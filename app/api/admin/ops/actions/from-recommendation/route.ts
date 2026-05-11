import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";
import { prepareActionFromRecommendation } from "@/lib/autonomous/actions/actionExecutor";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const enabled = await Promise.resolve(isActionGovernanceEnabled());
    if (!enabled) {
      return NextResponse.json({ error: "Action governance not enabled" }, { status: 503 });
    }
    const user = await requireUser();
    if (user.role !== "TEACHER" && user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const contentType = req.headers.get("content-type") ?? "";
    const body =
      contentType.includes("application/json")
        ? await req.json()
        : Object.fromEntries((await req.formData()).entries());
    if (typeof body?.agentDecisionId !== "string") {
      return NextResponse.json({ error: "agentDecisionId required" }, { status: 400 });
    }
    const result = await prepareActionFromRecommendation({
      agentDecisionId: body.agentDecisionId,
      actionType: typeof body.actionType === "string" ? body.actionType : null,
      requestedBy: user,
    });
    return NextResponse.json({
      actionExecutionId: result.actionExecution.id,
      approvalRequestId: result.approvalRequest?.id ?? result.actionExecution.approvalRequestId ?? null,
      status: result.actionExecution.status,
      riskLevel: result.policy.riskLevel,
      approvalRequired: result.policy.approvalRequired,
      draftOnly: result.policy.draftOnly,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to prepare action" }, { status: error?.status ?? 500 });
  }
}
