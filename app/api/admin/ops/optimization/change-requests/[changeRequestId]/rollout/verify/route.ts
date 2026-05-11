import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { recordRolloutVerification } from "@/lib/autonomous/optimization/rolloutVerificationService";

export const dynamic = "force-dynamic";

// POST /api/admin/ops/optimization/change-requests/[changeRequestId]/rollout/verify
// Body: { stage, outcome: "PASSED"|"FAILED"|"PARTIAL", notes }
export async function POST(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const outcome = String(body.outcome ?? "").toUpperCase();
    if (!["PASSED", "FAILED", "PARTIAL"].includes(outcome)) {
      return NextResponse.json({ error: "Invalid outcome. Use: PASSED | FAILED | PARTIAL" }, { status: 400 });
    }
    if (!body.notes || !body.stage) {
      return NextResponse.json({ error: "stage and notes are required" }, { status: 400 });
    }
    const result = await recordRolloutVerification({
      changeRequestId: params.changeRequestId,
      actor: user,
      stage: body.stage,
      outcome: outcome as "PASSED" | "FAILED" | "PARTIAL",
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, plan: result.plan, verificationRecord: result.verificationRecord });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to record rollout verification" }, { status: error?.status ?? 500 });
  }
}
