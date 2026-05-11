import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getImplementationAuditTrace } from "@/lib/autonomous/optimization/implementationWorkflowService";

export const dynamic = "force-dynamic";

// GET /api/admin/ops/optimization/change-requests/[changeRequestId]/audit
export async function GET(req: NextRequest, { params }: { params: { changeRequestId: string } }) {
  try {
    const user = await requireUser();
    const trace = await getImplementationAuditTrace(params.changeRequestId, user);
    return NextResponse.json({ trace });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to get audit trace" }, { status: error?.status ?? 500 });
  }
}
