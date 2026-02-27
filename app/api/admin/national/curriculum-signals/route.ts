import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recordMetricEvent } from "@/lib/metrics/events";
import { isCurriculumOptimizationEnabled } from "@/lib/serverFlags";
import { optimizeCurriculumSignals } from "@/lib/ai/curriculum/curriculumOptimizer";
import { computeNationalCurriculumSignals } from "@/lib/reporting/curriculum/nationalCurriculumSignals";

export const dynamic = "force-dynamic";

function parsePositiveInt(
  raw: string | null,
  fallback: number,
  key: string
): number {
  if (!raw) return fallback;
  const value = parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw Object.assign(new Error(`${key} must be a positive integer`), { status: 400 });
  }
  return value;
}

function parseThreshold(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const value = parseFloat(raw);
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw Object.assign(new Error("weakMasteryThreshold must be between 0 and 1"), { status: 400 });
  }
  return value;
}

function toCsvRows(input: {
  weakByGradeBand: Record<
    string,
    Array<{
      subject: string;
      strandKey: string;
      strandName: string;
      sampleSize: number;
      avgMastery: number;
      avgMasteryDelta: number;
      trendDirection: string;
      rank: number;
      reasons: string[];
    }>
  >;
}): string {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const header = [
    "gradeBand",
    "rankWithinGradeBand",
    "subject",
    "strandKey",
    "strandName",
    "sampleSize",
    "avgMastery",
    "avgMasteryDelta",
    "trendDirection",
    "weakReasons",
  ].join(",");

  const lines: string[] = [];
  const bands = Object.keys(input.weakByGradeBand).sort((a, b) => a.localeCompare(b));
  for (const gradeBand of bands) {
    for (const row of input.weakByGradeBand[gradeBand]) {
      lines.push(
        [
          gradeBand,
          row.rank,
          row.subject,
          row.strandKey,
          row.strandName,
          row.sampleSize,
          row.avgMastery,
          row.avgMasteryDelta,
          row.trendDirection,
          row.reasons.join(";"),
        ]
          .map(esc)
          .join(",")
      );
    }
  }

  return [header, ...lines].join("\n");
}

export async function GET(req: NextRequest) {
  const traceId = randomUUID();
  try {
    if (!isCurriculumOptimizationEnabled()) {
      return NextResponse.json({ error: "curriculum_optimization_disabled" }, { status: 404 });
    }

    const user = await requirePlatformAdmin();
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "json";

    const minSampleSize = parsePositiveInt(searchParams.get("minSampleSize"), 20, "minSampleSize");
    const weakBottomN = parsePositiveInt(searchParams.get("weakBottomN"), 3, "weakBottomN");
    const weakMasteryThreshold = parseThreshold(searchParams.get("weakMasteryThreshold"), 0.6);

    const signals = await computeNationalCurriculumSignals({
      minSampleSize,
      weakBottomN,
      weakMasteryThreshold,
    });
    const optimized = await optimizeCurriculumSignals(signals);

    await logAudit({
      userId: user.id,
      action: "curriculum.signals.national.viewed",
      resourceType: "curriculum_signals",
      schoolId: null,
      traceId,
      details: {
        scope: "national",
        format,
        minSampleSize: signals.summary.minSampleSize,
        weakBottomN: signals.summary.weakBottomN,
        weakMasteryThreshold: signals.summary.weakMasteryThreshold,
        eligibleStrandCount: signals.summary.eligibleStrandCount,
      },
    });

    await recordMetricEvent(
      "curriculum_signals_viewed",
      {
        scope: "national",
        format,
        eligibleStrandCount: signals.summary.eligibleStrandCount,
      },
      {
        scope: "national",
        scopeId: null,
        schoolId: null,
      }
    );

    if (format === "csv") {
      const csv = toCsvRows({
        weakByGradeBand: Object.fromEntries(
          optimized.weakStrands.map((item) => [item.gradeBand, item.strands])
        ),
      });
      const filename = `curriculum-signals-${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (format !== "json") {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    return NextResponse.json({
      scope: "national",
      generatedAt: new Date().toISOString(),
      advisoryLabel:
        "Advisory only. Curriculum emphasis suggestions do not auto-apply policy changes.",
      summary: signals.summary,
      weakStrandsByGradeBand: optimized.weakStrands,
      recommendedEmphasisChanges: optimized.recommendedEmphasisChanges,
      aiSummary: optimized.aiSummary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: err?.status ?? 500 }
    );
  }
}

