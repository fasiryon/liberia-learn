import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { pauseRollout } from "@/lib/autonomous/optimization/stagedRolloutService";

export const dynamic = "force-dynamic";

// POST /api/admin/ops/optimization/change-requests/[changeRequestId]/rollout/pause
export async function POST(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const updated = await pauseRollout({ changeRequestId: params.changeRequestId, actor: user, reason: body.reason ?? undefined });
    return NextResponse.json({ ok: true, changeRequest: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to pause rollout" }, { status: error?.status ?? 500 });
  }
}
