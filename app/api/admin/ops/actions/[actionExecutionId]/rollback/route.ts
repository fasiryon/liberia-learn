import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rollbackActionExecution } from "@/lib/autonomous/actions/rollbackEnforcementService";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { actionExecutionId: string } }) {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const action = await (prisma as any).actionExecution.findUnique({ where: { id: params.actionExecutionId } });
    if (!action) return NextResponse.json({ error: "ActionExecution not found" }, { status: 404 });
    if (!user.isPlatformAdmin && action.schoolId !== user.schoolId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const updated = await rollbackActionExecution({
      actionExecutionId: action.id,
      actorId: user.id,
      reason: body?.reason ?? "operator_rollback",
    });
    return NextResponse.json({ ok: true, actionExecutionId: updated.id, rollbackStatus: updated.rollbackStatus });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to rollback action" }, { status: error?.status ?? 500 });
  }
}

