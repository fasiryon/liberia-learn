import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDeadLetterSummary } from "@/lib/autonomous/runtime/deadLetterInspectionService";
import { isRuntimeDashboardEnabled } from "@/lib/serverFlags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isRuntimeDashboardEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const summary = await getDeadLetterSummary({
      schoolId: user.isPlatformAdmin ? null : user.schoolId,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load dead-letter summary" }, { status: error?.status ?? 500 });
  }
}
