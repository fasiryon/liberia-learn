import type { StudentPerformanceEvent } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isConfusionDetectionEnabled } from "@/lib/serverFlags";

function severityRank(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function conceptTagForEvent(event: Pick<StudentPerformanceEvent, "subject" | "lessonId" | "eventType">): string {
  return `${event.subject}::${event.lessonId ?? event.eventType}`;
}

async function createSignalIfNew(params: {
  studentId: string;
  lessonId?: string | null;
  conceptTag: string;
  confusionType: "repeat_attempts" | "low_score" | "long_duration" | "ai_dependency";
  severity: "low" | "medium" | "high";
  schoolId: string;
}) {
  const existing = await (prisma as any).confusionSignal.findFirst({
    where: {
      studentId: params.studentId,
      lessonId: params.lessonId ?? null,
      confusionType: params.confusionType,
      detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });

  if (existing) {
    return null;
  }

  return (prisma as any).confusionSignal.create({
    data: {
      studentId: params.studentId,
      lessonId: params.lessonId ?? null,
      conceptTag: params.conceptTag,
      confusionType: params.confusionType,
      severity: params.severity,
      schoolId: params.schoolId,
    },
  });
}

export async function detectConfusion(
  studentId: string,
  schoolId: string,
  recentEvents: StudentPerformanceEvent[]
): Promise<any[]> {
  if (!isConfusionDetectionEnabled()) {
    return [];
  }

  if (recentEvents.length === 0) {
    return [];
  }

  const signals: Array<Promise<any | null>> = [];

  for (const event of recentEvents) {
    if (event.lessonId && event.attempts > 3) {
      signals.push(
        createSignalIfNew({
          studentId,
          lessonId: event.lessonId,
          conceptTag: conceptTagForEvent(event),
          confusionType: "repeat_attempts",
          severity: event.attempts > 5 ? "high" : "medium",
          schoolId,
        })
      );
    }

    if (event.score < 0.5) {
      signals.push(
        createSignalIfNew({
          studentId,
          lessonId: event.lessonId,
          conceptTag: conceptTagForEvent(event),
          confusionType: "low_score",
          severity: event.score < 0.3 ? "high" : "medium",
          schoolId,
        })
      );
    }

    if (event.durationSeconds > 900) {
      signals.push(
        createSignalIfNew({
          studentId,
          lessonId: event.lessonId,
          conceptTag: conceptTagForEvent(event),
          confusionType: "long_duration",
          severity: event.durationSeconds > 1800 ? "high" : "low",
          schoolId,
        })
      );
    }
  }

  const lowScoreBySubject = recentEvents.reduce<Record<string, number>>((acc, event) => {
    if (event.score < 0.3) {
      acc[event.subject] = (acc[event.subject] ?? 0) + 1;
    }
    return acc;
  }, {});
  for (const [subject, count] of Object.entries(lowScoreBySubject)) {
    if (count >= 2) {
      const event = recentEvents.find((entry) => entry.subject === subject && entry.score < 0.3);
      if (event) {
        signals.push(
          createSignalIfNew({
            studentId,
            lessonId: event.lessonId,
            conceptTag: conceptTagForEvent(event),
            confusionType: "low_score",
            severity: "high",
            schoolId,
          })
        );
      }
    }
  }

  let aiDependencyRun = 0;
  for (const event of recentEvents) {
    if (event.aiAssistUsed) {
      aiDependencyRun += 1;
      if (aiDependencyRun >= 3) {
        signals.push(
          createSignalIfNew({
            studentId,
            lessonId: event.lessonId,
            conceptTag: conceptTagForEvent(event),
            confusionType: "ai_dependency",
            severity: "medium",
            schoolId,
          })
        );
        break;
      }
    } else {
      aiDependencyRun = 0;
    }
  }

  return (await Promise.all(signals))
    .filter(Boolean)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}
