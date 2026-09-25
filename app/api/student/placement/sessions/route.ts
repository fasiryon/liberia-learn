// route-policy: auth=session; scope=record; authority=placement-session-owner; rationale=a learner starts or resumes only their own tenant-bound server-held placement session
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { startOrResumeSession } from "@/lib/placementAuthority/sessionService";
import { placementErrorResponse } from "@/lib/placementAuthority/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await requireRole("STUDENT");
    return NextResponse.json(await startOrResumeSession(user), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return placementErrorResponse(error);
  }
}
