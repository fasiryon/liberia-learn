/** GET /api/admin/agents/cost — per-agent daily/weekly/monthly cost + trend + top users. */
import { NextResponse } from "next/server";
import { requireAgentAdmin, agentAdminStatus } from "@/lib/agents/admin/guard";
import { costDashboard } from "@/lib/agents/admin/stats";

export async function GET() {
  try {
    await requireAgentAdmin();
    return NextResponse.json(await costDashboard());
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
