import { runConfusionDetectionForStudent } from "@/lib/intelligence/confusionScheduler";

export async function handleConfusionDetectionJob(payload: {
  studentId: string;
  schoolId: string;
}) {
  if (!payload?.studentId || !payload?.schoolId) {
    throw new Error("CONFUSION_DETECTION job requires studentId and schoolId");
  }

  await runConfusionDetectionForStudent(payload.studentId, payload.schoolId);
}
