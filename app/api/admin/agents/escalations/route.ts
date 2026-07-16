/** GET /api/admin/agents/escalations — human-review queue (filter by status, default OPEN). */
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAdmin, agentAdminStatus } from "@/lib/agents/admin/guard";
import { listEscalations, type EscalationFilter } from "@/lib/agents/admin/escalations";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAgentAdmin();
    const filter = (new URL(req.url).searchParams.get("status") as EscalationFilter) ?? "OPEN";
    // Tenant scoping (2026-07-16 security fix): a school ADMIN passes their
    // own schoolId and sees only their school's escalations. A true
    // platform admin passes null and sees everything, same as before.
    const schoolId = user.isPlatformAdmin ? null : user.schoolId ?? null;
    return NextResponse.json({ escalations: await listEscalations(filter, schoolId) });
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
