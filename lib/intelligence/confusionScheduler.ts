import { prisma } from "@/lib/db";
import { detectConfusion } from "@/lib/intelligence/confusionDetector";
import { runInterventionCheck } from "@/lib/intelligence/interventionEngine";

export async function runConfusionDetectionForStudent(
  studentId: string,
  schoolId: string
): Promise<void> {
  try {
    const recentEvents = await (prisma as any).studentPerformanceEvent.findMany({
      where: { studentId, schoolId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const signals = await detectConfusion(studentId, schoolId, recentEvents);
    if (signals.length > 0) {
      await runInterventionCheck(studentId, schoolId, signals);
    }

    console.log("[intelligence.confusionScheduler] processed student", {
      studentId,
      schoolId,
      signalCount: signals.length,
    });
  } catch (error) {
    console.error("[intelligence.confusionScheduler] failed", {
      studentId,
      schoolId,
      error,
    });
  }
}
