import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { getManualRuntimeRunDetail } from "@/lib/autonomous/runtime/manualRuntimeRunService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  try {
    if (!isRuntimeDashboardEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requirePlatformAdmin();
    const run = await getManualRuntimeRunDetail(params.runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json({ ok: true, run });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load runtime run" }, { status: error?.status ?? 500 });
  }
}
