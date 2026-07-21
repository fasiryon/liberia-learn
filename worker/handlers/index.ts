import { JobType } from "@/lib/queue";
import { handleSnapshotAnalyticsJob } from "@/worker/handlers/analytics";
import { handleGenerateCertificationAssetsJob } from "@/worker/handlers/certificationAssets";
import { handleGenerateCourseThumbnailJob } from "@/worker/handlers/courseThumbnail";
import { handleGenerateEmbeddingsJob } from "@/worker/handlers/embeddings";
import { handleConfusionDetectionJob } from "@/worker/handlers/intelligence";
import { handleGenerateSchoolOnboardingKitJob } from "@/worker/handlers/onboardingKit";
import { handleOneRosterImportJob } from "@/worker/handlers/oneRosterImport";
import { handleSendSmsJob } from "@/worker/handlers/sms";
import { handleStudentImportJob } from "@/worker/handlers/studentImport";
import { handleGenerateTextbookJob } from "@/worker/handlers/textbook";
import {
  handleCurriculumRegenerationGroupJob,
  handleCurriculumRegenerationLessonJob,
  handleCurriculumRegenerationResumeJob,
} from "@/worker/handlers/curriculumRegeneration";

export type JobDispatchMetadata = {
  enqueuedAt?: string | null;
  retryCount?: number | null;
};

export async function dispatchJob(jobType: JobType, payload: unknown, metadata: JobDispatchMetadata = {}) {
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
    case JobType.STUDENT_IMPORT:
      return handleStudentImportJob(payload as { batchId: string; schoolId: string });
    case JobType.ONEROSTER_IMPORT:
      return handleOneRosterImportJob(payload as { batchId: string; schoolId: string });
    case JobType.GENERATE_COURSE_THUMBNAIL:
      return handleGenerateCourseThumbnailJob(payload as { contentId: string; schoolId?: string | null; actorUserId?: string | null }, metadata);
    case JobType.GENERATE_SCHOOL_ONBOARDING_KIT:
      return handleGenerateSchoolOnboardingKitJob(payload as { schoolId: string; actorUserId?: string | null }, metadata);
    case JobType.GENERATE_CERTIFICATION_ASSETS:
      return handleGenerateCertificationAssetsJob(payload as { certificationId: string; actorUserId: string }, metadata);
    case JobType.CURRICULUM_REGENERATE_LESSON:
      return handleCurriculumRegenerationLessonJob(payload as any);
    case JobType.CURRICULUM_REGENERATE_GROUP:
      return handleCurriculumRegenerationGroupJob(payload as any);
    case JobType.CURRICULUM_REGENERATE_RESUME:
      return handleCurriculumRegenerationResumeJob(payload as any);
    case JobType.QUEUE_READINESS_PROBE:
      return { status: "ok" };
    case JobType.HEALTH_CHECK:
      console.log("[HEALTH_CHECK] Worker alive:", new Date().toISOString());
      return { status: "ok", ts: new Date().toISOString() };
    // Known-but-unhandled types: ack without crashing so they don't fill the DLQ.
    case JobType.GENERATE_LESSON_AUDIO:
    case JobType.AUTONOMOUS_WORKFLOW_RUN:
      console.warn(`[WORKER] Job type ${jobType} not yet implemented; acking without processing`);
      return { status: "noop", jobType };
    default:
      // Unknown types are acked (not re-queued) to prevent DLQ flooding.
      console.warn(`[WORKER] Unknown job type: ${jobType}; acking`);
      return { status: "unknown", jobType };
  }
}
