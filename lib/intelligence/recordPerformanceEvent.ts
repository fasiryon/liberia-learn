import { prisma } from "@/lib/db";
import { runConfusionDetectionForStudent } from "@/lib/intelligence/confusionScheduler";
import { enqueueJob, isQueueConfigured, JobType } from "@/lib/queue";

const DEDUPE_WINDOW_MS = 5000;

export async function recordPerformanceEvent(params: {
  studentId: string;
  schoolId: string;
  subject: string;
  gradeLevel: number;
  eventType: "practice_attempt" | "quiz" | "lab" | "simulation";
  score: number;
  durationSeconds: number;
  attempts: number;
  aiAssistUsed: boolean;
  lessonId?: string;
}): Promise<void> {
  try {
    if (process.env.ENABLE_PERFORMANCE_EVENTS === "false") {
      return;
    }

    const performanceEventModel = (prisma as any).studentPerformanceEvent;
    if (!performanceEventModel?.findFirst || !performanceEventModel?.create) {
      return;
    }

    const existing = await performanceEventModel.findFirst({
      where: {
        studentId: params.studentId,
        lessonId: params.lessonId ?? null,
        eventType: params.eventType,
        createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
      },
      select: { id: true },
    });

    if (existing) {
      console.warn("[intelligence.performanceEvent] duplicate event suppressed", {
        studentId: params.studentId,
        lessonId: params.lessonId ?? null,
        eventType: params.eventType,
      });
      return;
    }

    await performanceEventModel.create({
      data: {
        studentId: params.studentId,
        lessonId: params.lessonId ?? null,
        subject: params.subject,
        gradeLevel: params.gradeLevel,
        eventType: params.eventType,
        score: params.score,
        durationSeconds: params.durationSeconds,
        attempts: params.attempts,
        aiAssistUsed: params.aiAssistUsed,
        schoolId: params.schoolId,
      },
    });

    if (isQueueConfigured()) {
      void enqueueJob(JobType.CONFUSION_DETECTION, {
        studentId: params.studentId,
        schoolId: params.schoolId,
      }).catch((error) => {
        console.error("[intelligence.performanceEvent] failed to enqueue confusion detection", error);
      });
      return;
    }

    void runConfusionDetectionForStudent(params.studentId, params.schoolId).catch((error) => {
      console.error("[intelligence.performanceEvent] confusion detection failed", error);
    });
  } catch (error) {
    console.error("[intelligence.performanceEvent] failed to record performance event", error);
  }
}
