import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getChangeRequest, submitChangeRequestForReview, cancelChangeRequest } from "@/lib/autonomous/optimization/optimizationChangeRequestService";

export const dynamic = "force-dynamic";

// GET /api/admin/ops/optimization/change-requests/[changeRequestId]
export async function GET(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const changeRequest = await getChangeRequest({ id: params.changeRequestId, actor: user });
    return NextResponse.json({ changeRequest });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to get change request" }, { status: error?.status ?? 500 });
  }
}

// PATCH /api/admin/ops/optimization/change-requests/[changeRequestId]
// Body: { action: "submit_for_review" | "cancel", reason?: string }
export async function PATCH(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (action === "submit_for_review") {
      const updated = await submitChangeRequestForReview({ id: params.changeRequestId, actor: user });
      return NextResponse.json({ ok: true, changeRequest: updated });
    }
    if (action === "cancel") {
      const updated = await cancelChangeRequest({ id: params.changeRequestId, actor: user, reason: body.reason ?? undefined });
      return NextResponse.json({ ok: true, changeRequest: updated });
    }
    return NextResponse.json({ error: "Invalid action. Use: submit_for_review | cancel" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to update change request" }, { status: error?.status ?? 500 });
  }
}
