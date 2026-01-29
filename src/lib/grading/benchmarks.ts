import { PrismaClient, CohortType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Phase-1: compute benchmark stats for a cohort (e.g., a class) for a single skill.
 * This is designed to run nightly (cron) or on-demand.
 */
export async function computeCohortBenchmark(params: {
  cohortType: CohortType;
  cohortId?: string | null; // null for NATIONAL
  skillId: string;
  measuredAt?: Date; // date boundary
  studentIds: string[]; // list of students in cohort
}) {
  const { cohortType, cohortId = null, skillId, measuredAt = new Date(), studentIds } = params;

  // For Phase-1, we use the most recent snapshot per student (current mastery)
  const latestByStudent = await Promise.all(
    studentIds.map(async (studentId) => {
      const last = await prisma.objectiveMasterySnapshot.findFirst({
        where: { studentId, skillId },
        orderBy: { measuredAt: "desc" },
        select: { masteryLevel: true },
      });
      return last?.masteryLevel ?? null;
    })
  );

  const values = latestByStudent.filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  const n = values.length;

  const percentile = (p: number) => {
    if (n === 0) return null;
    const idx = Math.floor((p / 100) * (n - 1));
    return values[idx];
  };

  const median = n === 0 ? null : values[Math.floor((n - 1) / 2)];
  const p25 = percentile(25);
  const p75 = percentile(75);

  return prisma.cohortBenchmark.upsert({
    where: {
      // No natural unique constraint; so we just create new row each run in Phase-1.
      // Later: add @@unique([cohortType, cohortId, skillId, measuredAtDate]) if desired.
      id: "___NOT_USED___",
    },
    update: {},
    create: {
      cohortType,
      cohortId: cohortId ?? undefined,
      skillId,
      measuredAt,
      medianMastery: median ?? undefined,
      p25Mastery: p25 ?? undefined,
      p75Mastery: p75 ?? undefined,
      sampleSize: n,
    },
  });
}
