import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { hasGenuineMoeAlignment } from "@/lib/moe/alignmentReader";

export const dynamic = "force-dynamic";

type SubjectCoverage = {
  subject: string;
  total: number;
  covered: number;
};

type SubjectBandCoverage = SubjectCoverage & {
  band: string;
};

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const traceId = randomUUID();
    const [allContent, allStandards] = await Promise.all([
      prisma.curriculumContent.findMany({
        where: { status: { in: ["APPROVED", "published", "approved"] } },
        select: { moeAlignments: true },
      }),
      prisma.standard.findMany({
        select: { code: true, subject: true, band: true },
      }),
    ]);

    const coveredCodes = new Set<string>();
    for (const content of allContent) {
      const alignments = content.moeAlignments as any;
      if (!alignments?.standards || !Array.isArray(alignments.standards)) {
        continue;
      }

      for (const standard of alignments.standards) {
        if (typeof standard?.code === "string" && standard.code.length > 0) {
          coveredCodes.add(standard.code);
        }
      }
    }

    const bySubject = new Map<string, SubjectCoverage>();
    const bySubjectBand = new Map<string, SubjectBandCoverage>();

    for (const standard of allStandards) {
      const subjectEntry = bySubject.get(standard.subject) ?? {
        subject: standard.subject,
        total: 0,
        covered: 0,
      };
      subjectEntry.total += 1;
      if (coveredCodes.has(standard.code)) {
        subjectEntry.covered += 1;
      }
      bySubject.set(standard.subject, subjectEntry);

      const bandKey = `${standard.subject}:${standard.band}`;
      const bandEntry = bySubjectBand.get(bandKey) ?? {
        subject: standard.subject,
        band: standard.band,
        total: 0,
        covered: 0,
      };
      bandEntry.total += 1;
      if (coveredCodes.has(standard.code)) {
        bandEntry.covered += 1;
      }
      bySubjectBand.set(bandKey, bandEntry);
    }

    const formatSubjectCoverage = (entry: SubjectCoverage) => ({
      ...entry,
      coveragePct: entry.total > 0 ? Math.round((entry.covered / entry.total) * 100) : 0,
    });

    const formatSubjectBandCoverage = (entry: SubjectBandCoverage) => ({
      ...entry,
      coveragePct: entry.total > 0 ? Math.round((entry.covered / entry.total) * 100) : 0,
    });

    await logAudit({
      userId: user.id,
      action: "ADMIN_CURRICULUM_WAEC_ALIGNMENT_VIEW",
      resourceType: "curriculum_alignment",
      schoolId: user.schoolId ?? null,
      traceId,
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      overview: {
        totalStandards: allStandards.length,
        coveredStandards: coveredCodes.size,
        coveragePct:
          allStandards.length > 0 ? Math.round((coveredCodes.size / allStandards.length) * 100) : 0,
        totalLessons: allContent.length,
        alignedLessons: allContent.filter((content) => hasGenuineMoeAlignment(content.moeAlignments)).length,
      },
      bySubject: Array.from(bySubject.values())
        .map(formatSubjectCoverage)
        .sort((left, right) => left.subject.localeCompare(right.subject)),
      bySubjectBand: Array.from(bySubjectBand.values())
        .map(formatSubjectBandCoverage)
        .sort((left, right) => {
          if (left.subject === right.subject) {
            return left.band.localeCompare(right.band);
          }
          return left.subject.localeCompare(right.subject);
        }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Internal error" },
      { status: error?.status ?? 500 }
    );
  }
}
