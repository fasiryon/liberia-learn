import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { enqueueJob, JobType, QueueUnavailableError } from "@/lib/queue";
import { isCanvaCourseThumbnailsEnabled } from "@/lib/serverFlags";
import { updateCurriculumOperationalFields } from "@/lib/curriculum/mutations/repository";

export async function enqueueCourseThumbnailGeneration(input: {
  contentId: string;
  actorUserId: string;
  schoolId?: string | null;
}) {
  if (typeof isCanvaCourseThumbnailsEnabled !== "function" || !isCanvaCourseThumbnailsEnabled()) return;

  await updateCurriculumOperationalFields(
    { contentId: input.contentId },
    { thumbnailStatus: "pending", thumbnailError: null },
  );

  const accepted = await enqueueJob(JobType.GENERATE_COURSE_THUMBNAIL, {
    contentId: input.contentId,
    schoolId: input.schoolId ?? null,
    actorUserId: input.actorUserId,
  });
  if (!accepted) {
    // Do not leave a "pending" thumbnail nobody will process, and do not audit it as enqueued.
    await updateCurriculumOperationalFields(
      { contentId: input.contentId },
      { thumbnailStatus: "failed", thumbnailError: "QUEUE_UNAVAILABLE" },
    );
    throw new QueueUnavailableError(JobType.GENERATE_COURSE_THUMBNAIL);
  }

  await logAudit({
    userId: input.actorUserId,
    schoolId: input.schoolId ?? null,
    action: "course.thumbnail.enqueued",
    resourceType: "curriculum",
    resourceId: input.contentId,
  });
}
