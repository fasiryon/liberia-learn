/** GET /api/admin/agents/triggers — event-triggered agent runs + success rate. */
import { NextResponse } from "next/server";
import { requireAgentAdmin, agentAdminStatus } from "@/lib/agents/admin/guard";
import { triggerMonitor } from "@/lib/agents/admin/stats";

export async function GET() {
  try {
    await requireAgentAdmin();
    return NextResponse.json({ triggers: await triggerMonitor() });
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
