// app/api/moe/narrative-reports/[id]/route.ts
// Sprint 6.3 — full draft narrative + data snapshot + changes summary, for
// a human to read in full before deciding what to do with it (Deliverable 3).
// Read-only: no route in this sprint changes a report's status.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin && !isMoeSuperRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const report = await prisma.reportDraft.findUnique({ where: { id } });
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    void logAudit({
      userId: user.id,
      action: "MOE_NARRATIVE_REPORT_VIEW",
      resourceType: "report_draft",
      resourceId: id,
    });

    return NextResponse.json({ report });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
