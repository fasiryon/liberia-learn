import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { getManualRuntimeRunHistory } from "@/lib/autonomous/runtime/manualRuntimeRunService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!isRuntimeDashboardEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requirePlatformAdmin();
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 100);
    const runs = await getManualRuntimeRunHistory(limit);
    return NextResponse.json({ ok: true, runs });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load runtime runs" }, { status: error?.status ?? 500 });
  }
}
