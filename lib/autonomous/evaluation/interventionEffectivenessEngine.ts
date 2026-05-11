import { prisma } from "@/lib/db";

export async function measureInterventionEffectiveness(input: {
  studentId?: string | null;
  schoolId?: string | null;
  actionExecutionId?: string | null;
}) {
  if (!input.studentId || !input.schoolId) {
    return { effectivenessScore: 0.5, reason: "no_student_scope", baseline: null, latest: null };
  }
  const snapshots = await (prisma as any).masterySnapshot.findMany({
    where: { studentId: input.studentId, schoolId: input.schoolId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  if (snapshots.length < 2) {
    return { effectivenessScore: 0.5, reason: "insufficient_mastery_snapshots", baseline: snapshots[0] ?? null, latest: snapshots[0] ?? null };
  }
  const baseline = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const before = Number(baseline.masteryScore ?? baseline.score ?? baseline.mastery ?? 0);
  const after = Number(latest.masteryScore ?? latest.score ?? latest.mastery ?? before);
  const delta = after - before;
  const effectivenessScore = delta > 0 ? Math.min(1, 0.5 + delta) : Math.max(0, 0.5 + delta);
  return { effectivenessScore: Number(effectivenessScore.toFixed(2)), reason: "mastery_delta", baseline: baseline.id, latest: latest.id, delta };
}

