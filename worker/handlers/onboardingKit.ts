import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendSchoolOnboardingKit } from "@/lib/email";
import { generateOnboardingKit } from "@/lib/schools/generateOnboardingKit";
import { isSchoolOnboardingKitsEnabled } from "@/lib/serverFlags";
import type { JobDispatchMetadata } from "@/worker/handlers";

type Payload = {
  schoolId: string;
  actorUserId?: string | null;
};

function getQueueWaitMs(metadata: JobDispatchMetadata) {
  if (!metadata.enqueuedAt) return null;
  const enqueuedTime = new Date(metadata.enqueuedAt).getTime();
  return Number.isFinite(enqueuedTime) ? Math.max(0, Date.now() - enqueuedTime) : null;
}

export async function handleGenerateSchoolOnboardingKitJob(payload: Payload, metadata: JobDispatchMetadata = {}) {
  if (typeof isSchoolOnboardingKitsEnabled !== "function" || !isSchoolOnboardingKitsEnabled()) return;
  if (!payload?.schoolId) {
    throw new Error("schoolId is required for GENERATE_SCHOOL_ONBOARDING_KIT");
  }

  const school = await prisma.school.findUnique({
    where: { id: payload.schoolId },
    select: { id: true, name: true, county: true, contactName: true, contactEmail: true, code: true },
  });
  if (!school) throw new Error("school not found");

  await prisma.school.update({
    where: { id: school.id },
    data: { onboardingKitStatus: "processing" },
  });
  await logAudit({
    userId: payload.actorUserId ?? null,
    schoolId: school.id,
    action: "school.onboarding_kit.processing",
    resourceType: "school",
    resourceId: school.id,
  });

  try {
    const generated = await generateOnboardingKit({
      schoolName: school.name,
      county: school.county,
      principalName: school.contactName,
      schoolCode: school.code,
      schoolId: school.id,
      actorUserId: payload.actorUserId ?? null,
      route: "worker.onboardingKit",
      jobName: "GENERATE_SCHOOL_ONBOARDING_KIT",
      queueWaitMs: getQueueWaitMs(metadata),
      retryCount: metadata.retryCount ?? null,
    });
    await prisma.school.update({
      where: { id: school.id },
      data: {
        onboardingKitUrl: generated.canvaUrl,
        onboardingKitStatus: "completed",
        onboardingGeneratedAt: new Date(),
      },
    });
    if (school.contactEmail) {
      await sendSchoolOnboardingKit({
        to: school.contactEmail,
        principalName: school.contactName ?? "Principal",
        schoolName: school.name,
        kitUrl: generated.canvaUrl,
      }).catch(() => null);
    }
    await logAudit({
      userId: payload.actorUserId ?? null,
      schoolId: school.id,
      action: "school.onboarding_kit.completed",
      resourceType: "school",
      resourceId: school.id,
    });
  } catch (error) {
    await prisma.school.update({
      where: { id: school.id },
      data: { onboardingKitStatus: "failed" },
    });
    await logAudit({
      userId: payload.actorUserId ?? null,
      schoolId: school.id,
      action: "school.onboarding_kit.failed",
      resourceType: "school",
      resourceId: school.id,
    });
    throw error;
  }
}
