import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { recordRollbackVerification } from "@/lib/autonomous/optimization/rollbackVerificationService";

export const dynamic = "force-dynamic";

// POST /api/admin/ops/optimization/change-requests/[changeRequestId]/rollback/verify
// Body: { checklistResults: Record<string, boolean>, restoredStateConfirmed: boolean, notes: string }
export async function POST(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden: rollback verification requires platform admin" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    if (!body.checklistResults || typeof body.checklistResults !== "object") {
      return NextResponse.json({ error: "checklistResults (object) is required" }, { status: 400 });
    }
    if (typeof body.restoredStateConfirmed !== "boolean") {
      return NextResponse.json({ error: "restoredStateConfirmed (boolean) is required" }, { status: 400 });
    }
    if (!body.notes) {
      return NextResponse.json({ error: "notes is required" }, { status: 400 });
    }
    const result = await recordRollbackVerification({
      changeRequestId: params.changeRequestId,
      actor: user,
      checklistResults: body.checklistResults,
      restoredStateConfirmed: body.restoredStateConfirmed,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, plan: result.plan, verificationRecord: result.verificationRecord });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to record rollback verification" }, { status: error?.status ?? 500 });
  }
}
