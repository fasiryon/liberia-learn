// route-policy: auth=session; scope=record; authority=placement-session-owner; rationale=session state is readable only by the learner who owns it and never includes answer keys for unanswered items
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getSession } from "@/lib/placementAuthority/sessionService";
import { placementErrorResponse } from "@/lib/placementAuthority/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const user = await requireRole("STUDENT");
    return NextResponse.json(await getSession(user, params.sessionId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return placementErrorResponse(error);
  }
}
