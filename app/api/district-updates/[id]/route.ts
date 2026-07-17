// app/api/district-updates/[id]/route.ts
// Sprint 6.4 — full draft text + data snapshot + changes summary, for a
// human to read in full before deciding what to do with it. Tenant-scoped.
// Read-only: no route in this sprint changes a draft's status.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDistrictUpdateIfVisible } from "@/lib/agents/admin/districtUpdates";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const update = await getDistrictUpdateIfVisible(
      { isPlatformAdmin: user.isPlatformAdmin, schoolId: user.schoolId ?? null },
      id
    );
    if (!update) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ update });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
