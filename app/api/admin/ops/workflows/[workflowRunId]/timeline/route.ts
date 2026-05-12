import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getIncidentTimeline } from "@/lib/autonomous/incidentTimelineService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { workflowRunId: string } }
) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin) {
      return NextResponse.json({ error: "Platform admin required" }, { status: 403 });
    }
    if (!isRuntimeDashboardEnabled()) {
      return NextResponse.json({ error: "Runtime dashboard disabled" }, { status: 403 });
    }

    const timeline = await getIncidentTimeline(params.workflowRunId);
    return NextResponse.json({ timeline });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status });
  }
}
