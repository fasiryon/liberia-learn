import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOptimizationRecommendation } from "@/lib/autonomous/optimization/optimizationReviewService";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { proposalEventId: string } }) {
  try {
    const user = await requireUser();
    const result = await getOptimizationRecommendation({ proposalEventId: params.proposalEventId, requester: user });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load optimization recommendation" }, { status: error?.status ?? 500 });
  }
}
