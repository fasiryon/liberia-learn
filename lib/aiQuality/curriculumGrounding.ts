/**
 * Sprint 6.8: curriculum-grounding coverage. Reuses the existing MOE
 * alignment engine's output (CurriculumContent.moeAlignments, written by
 * lib/moe/alignment-engine.ts) rather than judging alignment itself.
 *
 * Intentionally does not filter by CurriculumContent.status — a prior audit
 * of app/api/moe/align's GET handler found its `status: "accepted"` filter
 * matches zero real rows (real statuses are APPROVED/published/DRAFT/etc,
 * "accepted" doesn't exist in production data), so this counts across all
 * content to give the honest platform-wide figure.
 */
import { prisma } from "@/lib/db";

export type CurriculumGroundingMetric = {
  measurable: true;
  totalLessons: number;
  checkedLessons: number;
  coveragePct: number;
  source: string;
};

const SOURCE = "lib/moe/alignment-engine.ts via CurriculumContent.moeAlignments";

export async function getCurriculumGroundingMetric(): Promise<CurriculumGroundingMetric> {
  const result = await prisma.$queryRaw<Array<{ total: bigint; checked: bigint }>>`
    SELECT COUNT(*)::bigint AS total, COUNT("moeAlignments")::bigint AS checked
    FROM "CurriculumContent"
  `;

  const row = result[0] ?? { total: 0n, checked: 0n };
  const totalLessons = Number(row.total);
  const checkedLessons = Number(row.checked);

  return {
    measurable: true,
    totalLessons,
    checkedLessons,
    coveragePct: totalLessons > 0 ? (checkedLessons / totalLessons) * 100 : 0,
    source: SOURCE,
  };
}
