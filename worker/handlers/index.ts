import { JobType } from "@/lib/queue";
import { handleSnapshotAnalyticsJob } from "@/worker/handlers/analytics";
import { handleGenerateCertificationAssetsJob } from "@/worker/handlers/certificationAssets";
import { handleGenerateCourseThumbnailJob } from "@/worker/handlers/courseThumbnail";
import { handleGenerateEmbeddingsJob } from "@/worker/handlers/embeddings";
import { handleConfusionDetectionJob } from "@/worker/handlers/intelligence";
import { handleGenerateSchoolOnboardingKitJob } from "@/worker/handlers/onboardingKit";
import { handleSendSmsJob } from "@/worker/handlers/sms";
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
    default:
      throw new Error(`Unsupported job type: ${jobType}`);
  }
}
