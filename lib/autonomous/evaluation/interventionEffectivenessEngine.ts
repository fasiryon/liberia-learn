import { prisma } from "@/lib/db";

function clampScore(value: number) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

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
    const productSignals = await (prisma as any).learningEvent.findMany({
      where: {
        studentId: input.studentId,
        schoolId: input.schoolId,
        eventType: {
          in: [
            "lesson.completed",
            "assignment.submitted",
            "assignment.graded",
            "attendance.updated",
            "guardian.report_card.viewed",
            "teacher.feedback.created",
            "live_session.joined",
          ],
        },
        occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
    const positiveEngagement = productSignals.filter((event: any) =>
      ["lesson.completed", "assignment.submitted", "assignment.graded", "guardian.report_card.viewed", "teacher.feedback.created", "live_session.joined"].includes(event.eventType)
    ).length;
    const effectivenessScore = clampScore(0.45 + Math.min(positiveEngagement, 10) * 0.04);
    return {
      effectivenessScore,
      reason: productSignals.length > 0 ? "product_signal_composite" : "insufficient_mastery_snapshots",
      baseline: snapshots[0] ?? null,
      latest: snapshots[0] ?? null,
      signalCount: productSignals.length,
      signalTypes: Array.from(new Set(productSignals.map((event: any) => event.eventType))).sort(),
    };
  }
  const baseline = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const before = Number(baseline.masteryScore ?? baseline.score ?? baseline.mastery ?? 0);
  const after = Number(latest.masteryScore ?? latest.score ?? latest.mastery ?? before);
  const delta = after - before;
  const effectivenessScore = delta > 0 ? Math.min(1, 0.5 + delta) : Math.max(0, 0.5 + delta);
  return { effectivenessScore: Number(effectivenessScore.toFixed(2)), reason: "mastery_delta", baseline: baseline.id, latest: latest.id, delta };
}
