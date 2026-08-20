import { logAudit } from "@/lib/audit";
import { generateCourseThumbnail } from "@/lib/courses/generateCourseThumbnail";
import { prisma } from "@/lib/db";
import { isCanvaCourseThumbnailsEnabled } from "@/lib/serverFlags";
import type { JobDispatchMetadata } from "@/worker/handlers";
import { updateCurriculumOperationalFields } from "@/lib/curriculum/mutations/repository";

type Payload = {
  contentId: string;
  schoolId?: string | null;
  actorUserId?: string | null;
};

function getQueueWaitMs(metadata: JobDispatchMetadata) {
  if (!metadata.enqueuedAt) return null;
  const enqueuedTime = new Date(metadata.enqueuedAt).getTime();
  return Number.isFinite(enqueuedTime) ? Math.max(0, Date.now() - enqueuedTime) : null;
}

export async function handleGenerateCourseThumbnailJob(payload: Payload, metadata: JobDispatchMetadata = {}) {
  if (typeof isCanvaCourseThumbnailsEnabled !== "function" || !isCanvaCourseThumbnailsEnabled()) return;
  if (!payload?.contentId) {
    throw new Error("contentId is required for GENERATE_COURSE_THUMBNAIL");
  }

  const course = await prisma.curriculumContent.findUnique({
    where: { contentId: payload.contentId },
    select: { contentId: true, title: true, subject: true, grade: true, payload: true },
  });
  if (!course) throw new Error("course not found");

  const school = payload.schoolId
    ? await prisma.school.findUnique({ where: { id: payload.schoolId }, select: { name: true } })
    : null;

  await updateCurriculumOperationalFields(
    { contentId: payload.contentId },
    { thumbnailStatus: "processing", thumbnailError: null },
  );

  try {
    const payloadTitle = (course.payload as any)?.title;
    const generated = await generateCourseThumbnail({
      courseName: course.title ?? (typeof payloadTitle === "string" ? payloadTitle : course.contentId),
      subject: course.subject,
      gradeLevel: course.grade,
      schoolName: school?.name ?? null,
      tenantId: payload.schoolId ?? null,
      actorUserId: payload.actorUserId ?? null,
      route: "worker.courseThumbnail",
      jobName: "GENERATE_COURSE_THUMBNAIL",
      queueWaitMs: getQueueWaitMs(metadata),
      retryCount: metadata.retryCount ?? null,
    });
    await updateCurriculumOperationalFields(
      { contentId: payload.contentId },
      {
        thumbnailUrl: generated.canvaUrl,
        thumbnailStatus: "completed",
        thumbnailGeneratedAt: new Date(),
        thumbnailError: null,
      },
    );
    await logAudit({
      userId: payload.actorUserId ?? null,
      schoolId: payload.schoolId ?? null,
      action: "course.thumbnail.generated",
      resourceType: "curriculum",
      resourceId: payload.contentId,
    });
  } catch (error: any) {
    await updateCurriculumOperationalFields(
      { contentId: payload.contentId },
      { thumbnailStatus: "failed", thumbnailError: error?.message ?? "Generation failed" },
    );
    throw error;
  }
}
