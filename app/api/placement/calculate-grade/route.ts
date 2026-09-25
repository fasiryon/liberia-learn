// route-policy: auth=session; scope=record; authority=retired-client-placement; rationale=placement scoring is performed only by the server session; replaced by /api/student/placement/sessions
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Retired by server-authoritative placement V1: the browser no longer
// receives answer keys, decides correctness, or submits score/band/grade.
export async function POST() {
  try {
    await requireRole("STUDENT");
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unauthorized" }, { status: err?.status ?? 401 });
  }
  return NextResponse.json(
    {
      error: "This placement endpoint has been retired. Use the server-held placement session.",
      code: "placement_endpoint_retired",
      replacement: "/api/student/placement/sessions",
    },
    { status: 410 }
  );
}
