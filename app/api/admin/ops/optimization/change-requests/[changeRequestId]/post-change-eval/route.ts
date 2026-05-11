import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createPostChangeEvaluationPlan, getPostChangeEvaluationPlan } from "@/lib/autonomous/optimization/postChangeEvaluationService";

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
// Body: { evaluationWindowDays?: number }
export async function POST(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
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
