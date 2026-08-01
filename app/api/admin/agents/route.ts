/** GET /api/admin/agents — registered agents + status, invocation count, week cost. */
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { agentAdminStatus } from "@/lib/agents/admin/guard";
import "@/lib/agents/bootstrap";
import { listAgentsWithStats } from "@/lib/agents/admin/stats";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json({ agents: await listAgentsWithStats() });
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
