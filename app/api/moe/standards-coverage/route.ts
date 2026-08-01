// app/api/moe/standards-coverage/route.ts
// Block 28 — MOE Standards Coverage
// Returns national MOE standard coverage breakdown by subject and grade band.
// No PII — curriculum content counts only.

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isMoePortalEnabled } from "@/lib/serverFlags";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { hasGenuineMoeAlignment } from "@/lib/moe/alignmentReader";
import { isMoeSuperRole } from "@/lib/moe/rbac";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!isMoePortalEnabled()) {
      return NextResponse.json({ error: "MOE portal is disabled" }, { status: 404 });
    }

    const user = await requireUser();
    if (!user.isPlatformAdmin && !isMoeSuperRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [allContent, allStandards] = await Promise.all([
      prisma.curriculumContent.findMany({
        where: { status: { in: ["APPROVED", "published", "approved"] } },
        select: { moeAlignments: true },
      }),
      prisma.standard.findMany({
        select: { code: true, subject: true, band: true },
      }),
    ]);

    // Build set of covered MOE standard codes
    const coveredCodes = new Set<string>();
    for (const content of allContent) {
      const alignments = content.moeAlignments as any;
      if (alignments?.standards) {
        for (const s of alignments.standards) {
          if (s.code) coveredCodes.add(s.code);
        }
      }
    }

    // Group standards by subject+band
    const groups: Record<string, { subject: string; band: string; total: number; covered: number }> = {};
    for (const std of allStandards) {
      const key = `${std.subject}-${std.band}`;
      if (!groups[key]) {
        groups[key] = { subject: std.subject, band: std.band, total: 0, covered: 0 };
      }
      groups[key].total++;
      if (coveredCodes.has(std.code)) groups[key].covered++;
    }

    const bySubjectBand = Object.values(groups).map((g) => ({
      ...g,
      coveragePct: g.total > 0 ? Math.round((g.covered / g.total) * 100) : 0,
    }));

    void logAudit({
      userId: user.id,
      action: "MOE_STANDARDS_COVERAGE_VIEW",
      resourceType: "standards_coverage",
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overview: {
        totalStandards: allStandards.length,
        coveredStandards: coveredCodes.size,
        coveragePct:
          allStandards.length > 0
            ? Math.round((coveredCodes.size / allStandards.length) * 100)
            : 0,
        totalLessons: allContent.length,
        alignedLessons: allContent.filter((c) => hasGenuineMoeAlignment(c.moeAlignments)).length,
      },
      bySubjectBand,
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status });
  }
}
