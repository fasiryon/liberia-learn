// route-policy: auth=session; scope=tenant; authority=placement-review; rationale=a same-school reviewer records an instructional recommendation and never changes the official grade
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { recordPlacementReview } from "@/lib/placementAuthority/decisionService";
import { placementErrorResponse } from "@/lib/placementAuthority/http";

export const dynamic = "force-dynamic";

// PLACEMENT_REVIEW only. The official grade is set solely by
// POST /api/admin/placements/[id]/confirm (PLACEMENT_CONFIRM).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("TEACHER", "ADMIN");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await recordPlacementReview(user, id, body ?? {}));
  } catch (error) {
    return placementErrorResponse(error);
  }
}
