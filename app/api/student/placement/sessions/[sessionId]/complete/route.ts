// route-policy: auth=session; scope=record; authority=placement-session-owner; rationale=the server derives score band and recommendation from its own scored responses and records diagnostic evidence without changing official grade
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { completeSession } from "@/lib/placementAuthority/sessionService";
import { placementErrorResponse } from "@/lib/placementAuthority/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const user = await requireRole("STUDENT");
    return NextResponse.json(await completeSession(user, params.sessionId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return placementErrorResponse(error);
  }
}
