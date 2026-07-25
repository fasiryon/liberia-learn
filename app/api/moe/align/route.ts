// app/api/moe/align/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  alignContentToMOE,
  alignAllContent,
} from "@/lib/moe/alignment-engine";
import { prisma } from "@/lib/db";
import { hasGenuineMoeAlignment } from "@/lib/moe/alignmentReader";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const actor = await requireRole("MOE_OFFICIAL");
    if (!actor.isPlatformAdmin && actor.role !== "MOE_OFFICIAL") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    if (body.batch === true) {
      // Fire in background and return immediately
      alignAllContent({ force: body.force ?? false }).catch((err) =>
        console.error("[MOE-Align] Batch error:", err)
      );

      return NextResponse.json({
        ok: true,
        message: "Batch alignment started",
      });
    }

    if (!body.contentId) {
      return NextResponse.json(
        { error: "contentId is required" },
        { status: 400 }
      );
    }

    const result = await alignContentToMOE(body.contentId);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}

export async function GET(req: Request) {
  try {
    const actor = await requireRole("MOE_OFFICIAL");
    if (!actor.isPlatformAdmin && actor.role !== "MOE_OFFICIAL") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const isReport = searchParams.get("report") === "true";

    if (!isReport) {
      const statusFilter = { in: ["APPROVED", "published", "approved"] };
      const [total, aligned, unaligned] = await Promise.all([
        prisma.curriculumContent.count({
          where: { status: statusFilter },
        }),
        prisma.curriculumContent.count({
          where: { status: statusFilter, NOT: { moeAlignments: null } },
        }),
        prisma.curriculumContent.count({
          where: { status: statusFilter, moeAlignments: null },
        }),
      ]);

      return NextResponse.json({ total, aligned, unaligned });
    }

    // Full report
    const allContent = await prisma.curriculumContent.findMany({
      where: { status: { in: ["APPROVED", "published", "approved"] } },
      select: {
        id: true,
        subject: true,
        grade: true,
        moeAlignments: true,
      },
    });

    const allStandards = await prisma.standard.findMany({
      select: { code: true, subject: true, band: true },
    });

    // Build coverage set
    const coveredCodes = new Set<string>();
    for (const c of allContent) {
      const alignments = c.moeAlignments as any;
      if (alignments?.standards) {
        for (const s of alignments.standards) {
          if (s.code) coveredCodes.add(s.code);
        }
      }
    }

    // Group by subject+band
    const groups: Record<
      string,
      { subject: string; band: string; total: number; covered: number }
    > = {};

    for (const std of allStandards) {
      const key = `${std.subject}-${std.band}`;
      if (!groups[key]) {
        groups[key] = {
          subject: std.subject,
          band: std.band,
          total: 0,
          covered: 0,
        };
      }
      groups[key].total++;
      if (coveredCodes.has(std.code)) groups[key].covered++;
    }

    const bySubjectBand = Object.values(groups).map((g) => ({
      ...g,
      pct: g.total > 0 ? Math.round((g.covered / g.total) * 100) : 0,
    }));

    return NextResponse.json({
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
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status }
    );
  }
}
