// app/api/district-updates/route.ts
// Sprint 6.4 — District Competition / School-Update agent, Deliverable 3
// (human review surface). Lists DRAFT district-update rows, tenant-scoped
// (see lib/agents/admin/districtUpdates.ts). Read-only.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listDistrictUpdates } from "@/lib/agents/admin/districtUpdates";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const updates = await listDistrictUpdates(
      { isPlatformAdmin: user.isPlatformAdmin, schoolId: user.schoolId ?? null },
      { type: type === "standings" || type === "milestone" ? type : undefined }
    );

    return NextResponse.json({ updates });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
