import type { ConfusionSignal } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isInterventionEngineEnabled } from "@/lib/serverFlags";

const INTERVENTION_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

function subjectFromConceptTag(conceptTag: string): string {
  return conceptTag.split("::")[0] ?? conceptTag;
}

async function createRecommendationIfNew(params: {
  studentId: string;
  lessonId?: string | null;
  recommendationType: "review" | "extra_practice" | "teacher_attention" | "guardian_support";
  reason: string;
  confidenceScore: number;
  schoolId: string;
}) {
  const existing = await (prisma as any).interventionRecommendation.findFirst({
    where: {
      studentId: params.studentId,
      recommendationType: params.recommendationType,
      status: "pending",
    },
    select: { id: true },
  });

  if (existing) {
    return null;
  }

  return (prisma as any).interventionRecommendation.create({
    data: {
      studentId: params.studentId,
      lessonId: params.lessonId ?? null,
      recommendationType: params.recommendationType,
      reason: params.reason,
      confidenceScore: params.confidenceScore,
      status: "pending",
      expiresAt: new Date(Date.now() + INTERVENTION_EXPIRY_MS),
      schoolId: params.schoolId,
    },
  });
}

export async function runInterventionCheck(
  studentId: string,
  schoolId: string,
  signals: ConfusionSignal[]
): Promise<any[]> {
  if (!isInterventionEngineEnabled()) {
    return [];
  }

  const recommendations: Array<Promise<any | null>> = [];
  const highSignals = signals.filter((signal) => signal.severity === "high");

  const lowScoreOrRepeatSignal = highSignals.find(
    (signal) =>
      signal.confusionType === "low_score" || signal.confusionType === "repeat_attempts"
  );
  if (lowScoreOrRepeatSignal) {
    recommendations.push(
      createRecommendationIfNew({
        studentId,
        lessonId: lowScoreOrRepeatSignal.lessonId,
        recommendationType: "extra_practice",
        reason: "Student is struggling with repeated low scores",
        confidenceScore: 0.85,
        schoolId,
      })
    );
  }

  for (const signal of signals.filter((entry) => entry.confusionType === "long_duration")) {
    recommendations.push(
      createRecommendationIfNew({
        studentId,
        lessonId: signal.lessonId,
        recommendationType: "review",
        reason: "Student is spending excessive time on material",
        confidenceScore: 0.7,
        schoolId,
      })
    );
  }

  const highSignalCountsBySubject = highSignals.reduce<Record<string, number>>((acc, signal) => {
    const subject = subjectFromConceptTag(signal.conceptTag);
    acc[subject] = (acc[subject] ?? 0) + 1;
    return acc;
  }, {});

  if (Object.values(highSignalCountsBySubject).some((count) => count >= 2)) {
    recommendations.push(
      createRecommendationIfNew({
        studentId,
        lessonId: highSignals[0]?.lessonId ?? null,
        recommendationType: "teacher_attention",
        reason: "Multiple high-severity confusion signals detected",
        confidenceScore: 0.9,
        schoolId,
      })
    );

    const guardianLink = await prisma.studentGuardian.findFirst({
      where: { studentId },
      select: { id: true },
    });
    if (guardianLink) {
      recommendations.push(
        createRecommendationIfNew({
          studentId,
          lessonId: highSignals[0]?.lessonId ?? null,
          recommendationType: "guardian_support",
          reason: "Guardian encouragement may help with motivation",
          confidenceScore: 0.6,
          schoolId,
        })
      );
    }
  }

  return (await Promise.all(recommendations)).filter(Boolean);
}
