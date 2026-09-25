// route-policy: auth=session; scope=record; authority=placement-session-owner; rationale=the server scores a response bound to the learner session item version and operation id and never accepts client correctness
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { submitResponse } from "@/lib/placementAuthority/sessionService";
import { placementErrorResponse } from "@/lib/placementAuthority/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { sessionId: string } }) {
  try {
    const user = await requireRole("STUDENT");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body", code: "invalid_response" }, { status: 400 });
    }
    return NextResponse.json(await submitResponse(user, params.sessionId, body), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return placementErrorResponse(error);
  }
}
