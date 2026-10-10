// route-policy: auth=session; scope=tenant; authority=authenticated-student-own-school-enrollment-and-shared-curriculum-eligibility; rationale=bounded display-only discovery without decision or session writes
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { readLearnDiscovery, unavailableDiscovery } from "@/lib/student/learnDiscovery.server";

export const dynamic = "force-dynamic";

export async function GET() {
  let user;
  try {
    user = await requireRole("STUDENT");
  } catch (error: unknown) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Unavailable" }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    return NextResponse.json(await readLearnDiscovery(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    // Never replay a cached authorization result after enrollment or release revocation.
    return NextResponse.json(unavailableDiscovery(), { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
