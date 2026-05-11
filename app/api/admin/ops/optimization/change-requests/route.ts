import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listChangeRequests } from "@/lib/autonomous/optimization/optimizationChangeRequestService";

export const dynamic = "force-dynamic";

// GET /api/admin/ops/optimization/change-requests
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user.isPlatformAdmin && user.role !== "ADMIN" && user.role !== "MOE_OFFICIAL" && user.role !== "DISTRICT_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const schoolId = searchParams.get("schoolId") ?? undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
    const changeRequests = await listChangeRequests({ actor: user, status, schoolId, limit });
    return NextResponse.json({ changeRequests });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to list change requests" }, { status: error?.status ?? 500 });
  }
}
