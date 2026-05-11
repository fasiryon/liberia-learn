import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createImplementationWorkflow } from "@/lib/autonomous/optimization/implementationWorkflowService";

export const dynamic = "force-dynamic";

// POST /api/admin/ops/optimization/[proposalEventId]/implementation
// Creates an implementation workflow (WorkflowRun + OptimizationChangeRequest) from
// an approved optimization proposal. Never mutates policy/config directly.
export async function POST(req: NextRequest, { params }: { params: { proposalEventId: string } }) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN" && user.role !== "MOE_OFFICIAL") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await createImplementationWorkflow({ proposalEventId: params.proposalEventId, actor: user });
    return NextResponse.json({ ok: true, workflowRunId: result.workflowRun.id, changeRequest: result.changeRequest });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to create implementation workflow" }, { status: error?.status ?? 500 });
  }
}
