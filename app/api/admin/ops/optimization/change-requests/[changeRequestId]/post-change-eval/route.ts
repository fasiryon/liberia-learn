import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { completeFeedbackLoop } from "@/lib/autonomous/optimization/feedbackLoopCompletionService";
import { createPostChangeEvaluationPlan, getPostChangeEvaluationPlan, recordPostChangeMetrics } from "@/lib/autonomous/optimization/postChangeEvaluationService";

export const dynamic = "force-dynamic";

// GET /api/admin/ops/optimization/change-requests/[changeRequestId]/post-change-eval
export async function GET(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    await requireUser();
    const evalPlan = await getPostChangeEvaluationPlan(params.changeRequestId);
    return NextResponse.json({ evalPlan: evalPlan ?? null });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to get evaluation plan" }, { status: error?.status ?? 500 });
  }
}

// POST /api/admin/ops/optimization/change-requests/[changeRequestId]/post-change-eval
// Body: { evaluationWindowDays?: number, action?: "create" | "record_metrics" | "complete" }
export async function POST(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    if (body.action === "record_metrics") {
      const evalPlan = await recordPostChangeMetrics({ changeRequestId: params.changeRequestId, actorId: user.id, force: body.force === true });
      return NextResponse.json({ ok: true, evalPlan });
    }
    if (body.action === "complete") {
      const existing = await getPostChangeEvaluationPlan(params.changeRequestId);
      if (!existing) return NextResponse.json({ error: "Post-change evaluation plan not found" }, { status: 404 });
      const result = await completeFeedbackLoop({ evaluationPlanId: existing.id, actorId: user.id });
      return NextResponse.json({ ok: true, result });
    }
    const evalPlan = await createPostChangeEvaluationPlan({
      changeRequestId: params.changeRequestId,
      actor: user,
      evaluationWindowDays: body.evaluationWindowDays ?? undefined,
    });
    return NextResponse.json({ ok: true, evalPlan });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to create post-change evaluation plan" }, { status: error?.status ?? 500 });
  }
}
