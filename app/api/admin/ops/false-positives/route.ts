import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { markRecommendationFalsePositive } from "@/lib/autonomous/evaluation/falsePositiveReviewService";
import { isFalsePositiveReviewEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!isFalsePositiveReviewEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN" && user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const evaluation = await markRecommendationFalsePositive({
      agentDecisionId: body.agentDecisionId,
      reviewedBy: user,
      reason: body.reason ?? "operator_false_positive_review",
    });
    return NextResponse.json({ ok: true, evaluation });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to record false positive" }, { status: error?.status ?? 500 });
  }
}

