import { JobType } from "@/lib/queue";
import { handleSnapshotAnalyticsJob } from "@/worker/handlers/analytics";
import { handleGenerateEmbeddingsJob } from "@/worker/handlers/embeddings";
import { handleConfusionDetectionJob } from "@/worker/handlers/intelligence";
import { handleSendSmsJob } from "@/worker/handlers/sms";
import { handleGenerateTextbookJob } from "@/worker/handlers/textbook";

export async function dispatchJob(jobType: JobType, payload: unknown) {
  switch (jobType) {
    case JobType.GENERATE_EMBEDDINGS:
      return handleGenerateEmbeddingsJob(payload as { lessonId: string });
    case JobType.GENERATE_TEXTBOOK:
      return handleGenerateTextbookJob(payload as { subject: string; gradeLevel: number; schoolId?: string });
    case JobType.SNAPSHOT_ANALYTICS:
      return handleSnapshotAnalyticsJob(payload as { schoolId: string; tenantId?: string; snapshotDate?: string });
    case JobType.SEND_SMS:
      return handleSendSmsJob(payload as { to: string; body: string });
    case JobType.CONFUSION_DETECTION:
      return handleConfusionDetectionJob(payload as { studentId: string; schoolId: string });
    default:
      throw new Error(`Unsupported job type: ${jobType}`);
  }
}
