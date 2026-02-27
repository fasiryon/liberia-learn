import type { GradeBand, Subject } from "@prisma/client";
import { prisma } from "@/lib/db";

export type TrendDirection = "improving" | "stable" | "declining";

export type StrandAggregate = {
  gradeBand: GradeBand;
  subject: Subject;
  strandKey: string;
  strandName: string;
  sampleSize: number;
  avgMastery: number;
  avgMasteryDelta: number;
  trendDirection: TrendDirection;
};

export type WeakStrand = StrandAggregate & {
  rank: number;
  reasons: string[];
};

export type NationalCurriculumSignals = {
  rows: StrandAggregate[];
  weakByGradeBand: Record<string, WeakStrand[]>;
  summary: {
    totalProfilesConsidered: number;
    eligibleStrandCount: number;
    filteredOutBySample: number;
    minSampleSize: number;
    weakBottomN: number;
    weakMasteryThreshold: number;
  };
};

export type CurriculumSignalOptions = {
  minSampleSize?: number;
  weakBottomN?: number;
  weakMasteryThreshold?: number;
};

type AggregateBucket = {
  gradeBand: GradeBand;
  subject: Subject;
  strandKey: string;
  strandName: string;
  sampleSize: number;
  masterySum: number;
  masteryDeltaSum: number;
};

const DEFAULT_MIN_SAMPLE_SIZE = 20;
const DEFAULT_WEAK_BOTTOM_N = 3;
const DEFAULT_WEAK_MASTERY_THRESHOLD = 0.6;
const DECLINING_DELTA_THRESHOLD = -0.02;
const IMPROVING_DELTA_THRESHOLD = 0.02;

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function inferTrendDirection(avgMasteryDelta: number): TrendDirection {
  if (avgMasteryDelta <= DECLINING_DELTA_THRESHOLD) return "declining";
  if (avgMasteryDelta >= IMPROVING_DELTA_THRESHOLD) return "improving";
  return "stable";
}

function stableStrandSort(a: StrandAggregate, b: StrandAggregate): number {
  if (a.avgMastery !== b.avgMastery) return a.avgMastery - b.avgMastery;
  if (a.avgMasteryDelta !== b.avgMasteryDelta) return a.avgMasteryDelta - b.avgMasteryDelta;
  if (a.sampleSize !== b.sampleSize) return b.sampleSize - a.sampleSize;
  if (a.gradeBand !== b.gradeBand) return a.gradeBand.localeCompare(b.gradeBand);
  if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
  return a.strandKey.localeCompare(b.strandKey);
}

function buildReasons(
  row: StrandAggregate,
  params: { weakMasteryThreshold: number; isBottomRank: boolean }
): string[] {
  const reasons: string[] = [];
  if (params.isBottomRank) reasons.push("bottom_ranked_within_grade_band");
  if (row.avgMastery <= params.weakMasteryThreshold) reasons.push("below_mastery_threshold");
  if (row.trendDirection === "declining") reasons.push("declining_mastery_delta");
  return reasons;
}

function resolveConfig(options?: CurriculumSignalOptions) {
  const minSampleSize =
    typeof options?.minSampleSize === "number" && options.minSampleSize > 0
      ? Math.floor(options.minSampleSize)
      : DEFAULT_MIN_SAMPLE_SIZE;
  const weakBottomN =
    typeof options?.weakBottomN === "number" && options.weakBottomN > 0
      ? Math.floor(options.weakBottomN)
      : DEFAULT_WEAK_BOTTOM_N;
  const weakMasteryThreshold =
    typeof options?.weakMasteryThreshold === "number" &&
    options.weakMasteryThreshold >= 0 &&
    options.weakMasteryThreshold <= 1
      ? options.weakMasteryThreshold
      : DEFAULT_WEAK_MASTERY_THRESHOLD;

  return {
    minSampleSize,
    weakBottomN,
    weakMasteryThreshold,
  };
}

export async function computeNationalCurriculumSignals(
  options?: CurriculumSignalOptions
): Promise<NationalCurriculumSignals> {
  const config = resolveConfig(options);

  const profiles = await prisma.studentMasteryProfile.findMany({
    select: {
      subject: true,
      strandKey: true,
      currentScore: true,
      baselineScore: true,
      StrandCatalog: {
        select: {
          name: true,
          gradeBand: true,
        },
      },
    },
  });

  const buckets = new Map<string, AggregateBucket>();

  for (const row of profiles) {
    if (!row.StrandCatalog) continue;
    const gradeBand = row.StrandCatalog.gradeBand;
    const strandName = row.StrandCatalog.name;
    const key = `${gradeBand}|${row.subject}|${row.strandKey}`;
    const existing = buckets.get(key) ?? {
      gradeBand,
      subject: row.subject,
      strandKey: row.strandKey,
      strandName,
      sampleSize: 0,
      masterySum: 0,
      masteryDeltaSum: 0,
    };

    existing.sampleSize += 1;
    existing.masterySum += row.currentScore;
    existing.masteryDeltaSum += row.currentScore - row.baselineScore;
    buckets.set(key, existing);
  }

  const allRows = Array.from(buckets.values()).map<StrandAggregate>((bucket) => {
    const avgMastery = bucket.sampleSize > 0 ? bucket.masterySum / bucket.sampleSize : 0;
    const avgMasteryDelta =
      bucket.sampleSize > 0 ? bucket.masteryDeltaSum / bucket.sampleSize : 0;
    return {
      gradeBand: bucket.gradeBand,
      subject: bucket.subject,
      strandKey: bucket.strandKey,
      strandName: bucket.strandName,
      sampleSize: bucket.sampleSize,
      avgMastery: round4(avgMastery),
      avgMasteryDelta: round4(avgMasteryDelta),
      trendDirection: inferTrendDirection(avgMasteryDelta),
    };
  });

  const rows = allRows
    .filter((row) => row.sampleSize >= config.minSampleSize)
    .sort(stableStrandSort);

  const byBand = new Map<string, StrandAggregate[]>();
  for (const row of rows) {
    const list = byBand.get(row.gradeBand) ?? [];
    list.push(row);
    byBand.set(row.gradeBand, list);
  }

  const weakByGradeBand: Record<string, WeakStrand[]> = {};
  for (const [gradeBand, list] of byBand.entries()) {
    const sorted = [...list].sort(stableStrandSort);
    const weak = sorted
      .map((row, index) => {
        const isBottomRank = index < config.weakBottomN;
        const reasons = buildReasons(row, {
          weakMasteryThreshold: config.weakMasteryThreshold,
          isBottomRank,
        });
        if (reasons.length === 0) return null;
        return {
          ...row,
          rank: index + 1,
          reasons,
        } satisfies WeakStrand;
      })
      .filter((row): row is WeakStrand => row !== null);

    weakByGradeBand[gradeBand] = weak;
  }

  return {
    rows,
    weakByGradeBand,
    summary: {
      totalProfilesConsidered: profiles.length,
      eligibleStrandCount: rows.length,
      filteredOutBySample: allRows.length - rows.length,
      minSampleSize: config.minSampleSize,
      weakBottomN: config.weakBottomN,
      weakMasteryThreshold: config.weakMasteryThreshold,
    },
  };
}

