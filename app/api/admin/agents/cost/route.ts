/** GET /api/admin/agents/cost — per-agent daily/weekly/monthly cost + trend + top users. */
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { agentAdminStatus } from "@/lib/agents/admin/guard";
import { costDashboard } from "@/lib/agents/admin/stats";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json(await costDashboard());
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
