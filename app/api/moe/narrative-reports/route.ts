// app/api/moe/narrative-reports/route.ts
// Sprint 6.3 — MOE Narrative-Report agent, Deliverable 3 (human review surface)
// Lists recent DRAFT narrative reports for MOE review. Read-only.

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin && !isMoeSuperRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") ?? undefined;

    const reports = await prisma.reportDraft.findMany({
      where: scope ? { scope } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        scope: true,
        scopeId: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        createdAt: true,
      },
    });

    void logAudit({
      userId: user.id,
      action: "MOE_NARRATIVE_REPORTS_LIST_VIEW",
      resourceType: "report_draft",
    });

    return NextResponse.json({ reports });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
