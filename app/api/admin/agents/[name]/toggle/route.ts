/** POST /api/admin/agents/[name]/toggle — set the runtime kill-switch override. */
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAdmin, agentAdminStatus } from "@/lib/agents/admin/guard";
import { setAgentControl } from "@/lib/agents/control";

export async function POST(req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  try {
    const user = await requireAgentAdmin();
    const { name } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    // enabled: true | false | null (null clears the override → defer to env flag)
    const enabled = body?.enabled === null ? null : Boolean(body?.enabled);
    await setAgentControl(name, enabled, user.id);
    return NextResponse.json({ ok: true, agentName: name, enabled });
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
