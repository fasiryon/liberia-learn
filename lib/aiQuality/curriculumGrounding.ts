/**
 * Sprint 6.8: curriculum-grounding coverage. Reuses the existing MOE
 * alignment engine's output (CurriculumContent.moeAlignments, written by
 * lib/moe/alignment-engine.ts) rather than judging alignment itself.
 *
 * Intentionally does not filter by CurriculumContent.status: this counts
 * across all content to give the honest platform-wide figure, independent
 * of which status values the alignment/backfill jobs happen to target.
 *
 * "Checked" and "coverage" are deliberately kept as two distinct numbers:
 * - checkedLessons/checkedPct: moeAlignments is non-null, i.e. an alignment
 *   attempt ran (this includes lessons where no standard existed to match
 *   at all — an empty `standards: []` result still counts as "checked").
 * - matchedLessons/coveragePct: moeAlignments.standards is a non-empty
 *   array, i.e. a genuine standard was actually matched. "Coverage" as a
 *   term on this platform means ONLY this number — never the checked count.
 */
import { prisma } from "@/lib/db";

export type CurriculumGroundingMetric = {
  measurable: true;
  totalLessons: number;
  checkedLessons: number;
  matchedLessons: number;
  coveragePct: number;
  checkedPct: number;
  source: string;
};

const SOURCE = "lib/moe/alignment-engine.ts via CurriculumContent.moeAlignments";

export async function getCurriculumGroundingMetric(): Promise<CurriculumGroundingMetric> {
  const result = await prisma.$queryRaw<Array<{ total: bigint; checked: bigint; matched: bigint }>>`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT("moeAlignments")::bigint AS checked,
      COUNT(*) FILTER (
        WHERE jsonb_array_length(COALESCE("moeAlignments"->'standards', '[]'::jsonb)) > 0
      )::bigint AS matched
    FROM "CurriculumContent"
  `;

  const row = result[0] ?? { total: 0n, checked: 0n, matched: 0n };
  const totalLessons = Number(row.total);
  const checkedLessons = Number(row.checked);
  const matchedLessons = Number(row.matched);

  return {
    measurable: true,
    totalLessons,
    checkedLessons,
    matchedLessons,
    coveragePct: totalLessons > 0 ? (matchedLessons / totalLessons) * 100 : 0,
    checkedPct: totalLessons > 0 ? (checkedLessons / totalLessons) * 100 : 0,
    source: SOURCE,
  };
}
