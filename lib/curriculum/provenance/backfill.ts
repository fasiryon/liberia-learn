import { prisma } from "@/lib/db";
import { ensureCurriculumProvenance } from "@/lib/curriculum/mutations/repository";

export type BackfillDistribution = {
  VERIFIED: number;
  PARTIAL: number;
  UNVERIFIED: number;
};

export type BackfillResult = {
  dryRun: boolean;
  backfillRunId: string;
  scanned: number;
  created: number;
  alreadyPresent: number;
  failures: Array<{ contentId: string; error: string }>;
  distribution: BackfillDistribution;
  nextCursor: string | null;
};

export async function backfillCurriculumProvenance(options: {
  dryRun: boolean;
  backfillRunId: string;
  batchSize?: number;
  cursor?: string | null;
}): Promise<BackfillResult> {
  if (!options.backfillRunId.trim()) throw new Error("backfillRunId is required");
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 25, 100));
  const rows = await prisma.curriculumContent.findMany({
    where: options.cursor ? { id: { gt: options.cursor } } : undefined,
    orderBy: { id: "asc" },
    take: batchSize,
    include: { provenance: true },
  });
  const distribution: BackfillDistribution = { VERIFIED: 0, PARTIAL: 0, UNVERIFIED: 0 };
  const result: BackfillResult = {
    dryRun: options.dryRun,
    backfillRunId: options.backfillRunId,
    scanned: rows.length,
    created: 0,
    alreadyPresent: 0,
    failures: [],
    distribution,
    nextCursor: rows.at(-1)?.id ?? null,
  };

  for (const row of rows) {
    if (row.provenance) {
      result.alreadyPresent += 1;
      distribution[row.provenance.provenanceCompleteness] += 1;
      continue;
    }
    distribution.UNVERIFIED += 1;
    if (options.dryRun) continue;
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.curriculumContent.findUniqueOrThrow({ where: { id: row.id } });
        await ensureCurriculumProvenance(tx, current, { backfillRunId: options.backfillRunId });
      });
      result.created += 1;
    } catch (error) {
      result.failures.push({
        contentId: row.contentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}

export async function verifyCurriculumProvenanceBackfill(): Promise<{
  contentCount: number;
  rootCount: number;
  missingRoots: number;
  invalidPointers: number;
  duplicateSequences: number;
}> {
  const [contentCount, rootCount, missingRoots, invalidPointers, duplicateSequences] =
    await Promise.all([
      prisma.curriculumContent.count(),
      prisma.curriculumProvenance.count(),
      prisma.curriculumContent.count({ where: { provenance: null } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count
        FROM "CurriculumProvenance" p
        LEFT JOIN "CurriculumContentRevision" r
          ON r.id = p."currentRevisionId" AND r."provenanceId" = p.id
        WHERE p."currentRevisionId" IS NULL OR r.id IS NULL
      `.then((rows) => Number(rows[0]?.count ?? 0)),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count
        FROM (
          SELECT "provenanceId", sequence
          FROM "CurriculumContentRevision"
          GROUP BY "provenanceId", sequence
          HAVING count(*) > 1
        ) duplicates
      `.then((rows) => Number(rows[0]?.count ?? 0)),
    ]);
  return { contentCount, rootCount, missingRoots, invalidPointers, duplicateSequences };
}
