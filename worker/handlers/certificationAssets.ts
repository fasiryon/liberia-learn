import { logAudit } from "@/lib/audit";
import {
  generateCertificationBanner,
  generateHiggsfieldPromoVideo,
} from "@/lib/certifications/generateCertificationAssets";
import { prisma } from "@/lib/db";
import {
  isCertificationAssetGenerationEnabled,
  isHiggsfieldVideoGenerationEnabled,
} from "@/lib/serverFlags";
import type { JobDispatchMetadata } from "@/worker/handlers";

type Payload = {
  certificationId: string;
  actorUserId: string;
};

function getQueueWaitMs(metadata: JobDispatchMetadata) {
  if (!metadata.enqueuedAt) return null;
  const enqueuedTime = new Date(metadata.enqueuedAt).getTime();
  return Number.isFinite(enqueuedTime) ? Math.max(0, Date.now() - enqueuedTime) : null;
}

export async function handleGenerateCertificationAssetsJob(payload: Payload, metadata: JobDispatchMetadata = {}) {
  if (typeof isCertificationAssetGenerationEnabled !== "function" || !isCertificationAssetGenerationEnabled()) return;
  if (!payload?.certificationId || !payload.actorUserId) {
    throw new Error("certificationId and actorUserId are required for GENERATE_CERTIFICATION_ASSETS");
  }

  const certification = await prisma.examCertification.findUnique({
    where: { id: payload.certificationId },
    select: { id: true, subject: true, grade: true, exam: { select: { title: true, schoolId: true } } },
  });
  if (!certification) throw new Error("certification not found");

  await prisma.examCertification.update({
    where: { id: certification.id },
    data: { assetGenerationStatus: "processing" },
  });

  try {
    const queueWaitMs = getQueueWaitMs(metadata);
    const bannerPromise = generateCertificationBanner({
      title: certification.exam.title,
      subject: certification.subject,
      grade: certification.grade,
      schoolId: certification.exam.schoolId,
      actorUserId: payload.actorUserId,
      route: "worker.certificationAssets",
      jobName: "GENERATE_CERTIFICATION_ASSETS",
      queueWaitMs,
      retryCount: metadata.retryCount ?? null,
    });
    const videoPromise = typeof isHiggsfieldVideoGenerationEnabled === "function" && isHiggsfieldVideoGenerationEnabled()
      ? generateHiggsfieldPromoVideo({
          title: certification.exam.title,
          subject: certification.subject,
          grade: certification.grade,
          schoolId: certification.exam.schoolId,
          actorUserId: payload.actorUserId,
          route: "worker.certificationAssets",
          jobName: "GENERATE_CERTIFICATION_ASSETS",
          queueWaitMs,
          retryCount: metadata.retryCount ?? null,
        })
      : Promise.resolve({ videoUrl: certification.id ? "" : "" });

    const [bannerResult, videoResult] = await Promise.allSettled([bannerPromise, videoPromise]);
    const banner = bannerResult.status === "fulfilled" ? bannerResult.value : null;
    const video = videoResult.status === "fulfilled" ? videoResult.value : null;
    const failures = [
      bannerResult.status === "rejected"
        ? { assetType: "certification_banner", reason: bannerResult.reason?.message ?? "Banner generation failed" }
        : null,
      videoResult.status === "rejected"
        ? { assetType: "certification_video", reason: videoResult.reason?.message ?? "Video generation failed" }
        : null,
    ].filter(Boolean);

    await prisma.examCertification.update({
      where: { id: certification.id },
      data: {
        ...(banner?.canvaUrl ? { bannerUrl: banner.canvaUrl } : {}),
        ...(video?.videoUrl ? { videoUrl: video.videoUrl } : {}),
        assetGenerationStatus: failures.length ? "failed" : "completed",
      },
    });
    await logAudit({
      userId: payload.actorUserId,
      schoolId: certification.exam.schoolId,
      action: failures.length ? "certification.assets.failed" : "certification.assets.generated",
      resourceType: "examCertification",
      resourceId: certification.id,
      details: {
        hasBanner: Boolean(banner?.canvaUrl),
        hasVideo: Boolean(video?.videoUrl),
        failures,
      },
    });
    if (failures.length) {
      throw new Error("Certification asset generation partially failed");
    }
  } catch (error) {
    await prisma.examCertification.update({
      where: { id: certification.id },
      data: { assetGenerationStatus: "failed" },
    });
    await logAudit({
      userId: payload.actorUserId,
      schoolId: certification.exam.schoolId,
      action: "certification.assets.failed",
      resourceType: "examCertification",
      resourceId: certification.id,
      details: { reason: error instanceof Error ? error.message : "Generation failed" },
    });
    throw error;
  }
}
