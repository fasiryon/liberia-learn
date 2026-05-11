import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rejectAction } from "@/lib/autonomous/actions/approvalDecisionService";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { approvalRequestId: string } }) {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    const contentType = req.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await req.json().catch(() => ({}))
      : Object.fromEntries((await req.formData()).entries());
    const result = await rejectAction({
      approvalRequestId: params.approvalRequestId,
      decidedBy: user,
      comment: typeof body?.comment === "string" ? body.comment : null,
    });
    return NextResponse.json({ ok: true, actionExecutionId: result.id, status: result.status });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to reject action" }, { status: error?.status ?? 500 });
  }
}
