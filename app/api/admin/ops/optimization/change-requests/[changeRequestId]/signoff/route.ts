import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { recordReviewerSignoff } from "@/lib/autonomous/optimization/reviewerSignoffService";

export const dynamic = "force-dynamic";

// POST /api/admin/ops/optimization/change-requests/[changeRequestId]/signoff
// Body: { decision: "APPROVED" | "REJECTED", comment?: string }
export async function POST(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const decision = String(body.decision ?? "").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return NextResponse.json({ error: "Invalid decision. Use: APPROVED | REJECTED" }, { status: 400 });
    }
    const result = await recordReviewerSignoff({
      changeRequestId: params.changeRequestId,
      actor: user,
      decision: decision as "APPROVED" | "REJECTED",
      comment: body.comment ?? null,
    });
    return NextResponse.json({ ok: true, signoff: result.signoff, changeRequest: result.changeRequest, allApproved: result.allApproved });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to record signoff" }, { status: error?.status ?? 500 });
  }
}
