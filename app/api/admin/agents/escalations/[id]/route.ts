/** PATCH /api/admin/agents/escalations/[id] — assign or resolve a queue item. */
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAdmin, agentAdminStatus } from "@/lib/agents/admin/guard";
import { assignEscalation, resolveEscalation } from "@/lib/agents/admin/escalations";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAgentAdmin();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    if (body?.action === "resolve") {
      const resolution = typeof body.resolution === "string" ? body.resolution : "";
      if (!resolution.trim()) {
        return NextResponse.json({ error: "resolution_required" }, { status: 400 });
      }
      await resolveEscalation(id, resolution, user.id);
      return NextResponse.json({ ok: true, status: "RESOLVED" });
    }
    if (body?.action === "assign") {
      const assignedTo = typeof body.assignedTo === "string" ? body.assignedTo : user.id;
      await assignEscalation(id, assignedTo, user.id);
      return NextResponse.json({ ok: true, status: "IN_PROGRESS" });
    }
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "request_failed" }, { status: agentAdminStatus(err) });
  }
}
