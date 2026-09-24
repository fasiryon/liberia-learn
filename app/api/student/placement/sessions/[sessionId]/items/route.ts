// route-policy: auth=session; scope=record; authority=placement-session-owner; rationale=items are issued by the server into the learner's own session and serialized without the answer key
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rateLimit";
import { issueNextItem } from "@/lib/placementAuthority/sessionService";
import { placementErrorResponse } from "@/lib/placementAuthority/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const user = await requireRole("STUDENT");
    const limit = await checkRateLimit(user.id, { windowMs: 60_000, limit: 20, namespace: "placement_item_issue" });
    if (!limit.allowed) return rateLimitExceededResponse(limit);
    return NextResponse.json(await issueNextItem(user, params.sessionId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return placementErrorResponse(error);
  }
}
