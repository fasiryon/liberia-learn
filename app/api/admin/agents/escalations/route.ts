/** GET /api/admin/agents/escalations — human-review queue (filter by status, default OPEN). */
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAdmin, agentAdminStatus } from "@/lib/agents/admin/guard";
import { listEscalations, type EscalationFilter } from "@/lib/agents/admin/escalations";

export async function GET(req: NextRequest) {
  try {
    await requireAgentAdmin();
    const filter = (new URL(req.url).searchParams.get("status") as EscalationFilter) ?? "OPEN";
    return NextResponse.json({ escalations: await listEscalations(filter) });
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
