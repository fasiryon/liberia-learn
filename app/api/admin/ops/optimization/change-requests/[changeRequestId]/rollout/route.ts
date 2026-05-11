import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prepareStagedRolloutPlan, getRolloutPlan } from "@/lib/autonomous/optimization/stagedRolloutService";

export const dynamic = "force-dynamic";

// GET /api/admin/ops/optimization/change-requests/[changeRequestId]/rollout
export async function GET(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN" && user.role !== "MOE_OFFICIAL") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const plan = await getRolloutPlan(params.changeRequestId);
    if (!plan) return NextResponse.json({ plan: null }, { status: 200 });
    return NextResponse.json({ plan });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to get rollout plan" }, { status: error?.status ?? 500 });
  }
}

// POST /api/admin/ops/optimization/change-requests/[changeRequestId]/rollout
// Prepares the staged rollout plan for an approved change request.
export async function POST(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const plan = await prepareStagedRolloutPlan({ changeRequestId: params.changeRequestId, actor: user });
    return NextResponse.json({ ok: true, plan });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to prepare rollout plan" }, { status: error?.status ?? 500 });
  }
}
