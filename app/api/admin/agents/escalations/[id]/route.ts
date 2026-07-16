/** PATCH /api/admin/agents/escalations/[id] — assign or resolve a queue item. */
import { NextRequest, NextResponse } from "next/server";
import { requireAgentAdmin, agentAdminStatus } from "@/lib/agents/admin/guard";
import { assignEscalation, resolveEscalation, isEscalationInSchool } from "@/lib/agents/admin/escalations";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAgentAdmin();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    // Tenant scoping (2026-07-16 security fix), defense-in-depth: a school
    // ADMIN cannot assign/resolve an escalation outside their own school,
    // even if they already know or guess its ID. A true platform admin
    // bypasses this check entirely, same as the list endpoint.
    if (!user.isPlatformAdmin) {
      if (!user.schoolId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const inScope = await isEscalationInSchool(id, user.schoolId);
      if (!inScope) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

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
