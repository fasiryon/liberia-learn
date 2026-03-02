// app/api/moe/curriculum-health/route.ts
// Block 28 — MOE Curriculum Health
// Returns national curriculum content health: alignment rates by subject.
// No PII — content-level aggregates only.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allContent = await prisma.curriculumContent.findMany({
      where: { status: { in: ["published", "accepted"] } },
      select: { subject: true, moeAlignments: true, status: true },
    });

    // Group by subject
    const subjectMap: Record<string, { total: number; aligned: number }> = {};
    for (const c of allContent) {
      if (!subjectMap[c.subject]) {
        subjectMap[c.subject] = { total: 0, aligned: 0 };
      }
      subjectMap[c.subject].total++;
      if (c.moeAlignments) subjectMap[c.subject].aligned++;
    }

    const bySubject = Object.entries(subjectMap).map(([subject, counts]) => ({
      subject,
      total: counts.total,
      aligned: counts.aligned,
      unaligned: counts.total - counts.aligned,
      alignmentPct:
        counts.total > 0 ? Math.round((counts.aligned / counts.total) * 100) : 0,
    }));

    const totalContent = allContent.length;
    const alignedContent = allContent.filter((c) => c.moeAlignments).length;

    void logAudit({
      userId: user.id,
      action: "MOE_CURRICULUM_HEALTH_VIEW",
      resourceType: "curriculum_health",
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      national: {
        totalContent,
        alignedContent,
        unalignedContent: totalContent - alignedContent,
        alignmentPct:
          totalContent > 0 ? Math.round((alignedContent / totalContent) * 100) : 0,
      },
      bySubject,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
