import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getExecutionHealth } from "@/lib/autonomous/actions/executionHealthService";
import { isActionGovernanceEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isActionGovernanceEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const health = await getExecutionHealth({ schoolId: user.isPlatformAdmin ? null : user.schoolId });
    return NextResponse.json({ ok: true, health });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load worker health" }, { status: error?.status ?? 500 });
  }
}

