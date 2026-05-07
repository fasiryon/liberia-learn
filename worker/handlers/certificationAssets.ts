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

type Payload = {
  certificationId: string;
  actorUserId: string;
};

export async function handleGenerateCertificationAssetsJob(payload: Payload) {
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
    const bannerPromise = generateCertificationBanner({
      title: certification.exam.title,
      subject: certification.subject,
      grade: certification.grade,
    });
    const videoPromise = typeof isHiggsfieldVideoGenerationEnabled === "function" && isHiggsfieldVideoGenerationEnabled()
      ? generateHiggsfieldPromoVideo({
          title: certification.exam.title,
          subject: certification.subject,
          grade: certification.grade,
        })
      : Promise.resolve({ videoUrl: certification.id ? "" : "" });

    const [banner, video] = await Promise.all([bannerPromise, videoPromise]);
    await prisma.examCertification.update({
      where: { id: certification.id },
      data: {
        bannerUrl: banner.canvaUrl,
        videoUrl: video.videoUrl || null,
        assetGenerationStatus: "completed",
      },
    });
    await logAudit({
      userId: payload.actorUserId,
      schoolId: certification.exam.schoolId,
      action: "certification.assets.generated",
      resourceType: "examCertification",
      resourceId: certification.id,
      details: { hasVideo: Boolean(video.videoUrl) },
    });
  } catch (error) {
    await prisma.examCertification.update({
      where: { id: certification.id },
      data: { assetGenerationStatus: "failed" },
    });
    throw error;
  }
}
