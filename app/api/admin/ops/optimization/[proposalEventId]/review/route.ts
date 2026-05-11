import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { reviewOptimizationRecommendation } from "@/lib/autonomous/optimization/optimizationReviewService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { proposalEventId: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const status = String(body.status ?? "").toUpperCase();
    if (!["APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
      return NextResponse.json({ error: "Invalid review status" }, { status: 400 });
    }
    const result = await reviewOptimizationRecommendation({
      proposalEventId: params.proposalEventId,
      reviewer: user,
      status: status as any,
      comment: body.comment ?? null,
    });
    return NextResponse.json({ ok: true, review: result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to review optimization recommendation" }, { status: error?.status ?? 500 });
  }
}
