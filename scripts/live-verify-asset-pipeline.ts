import { randomUUID } from "crypto";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type Check = { name: string; ok: boolean; detail?: string };

for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
  const value = process.env[key]?.trim();
  if (value?.startsWith('"') && value.endsWith('"')) {
    process.env[key] = value.slice(1, -1);
  } else if (value) {
    process.env[key] = value;
  }
}

function printCheck(check: Check) {
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` - ${check.detail}` : ""}`);
}

async function main() {
  const checks: Check[] = [];
  const runId = `asset-live-${Date.now()}`;

  const { GET } = await import("@/app/api/health/canva/route");
  const { prisma } = await import("@/lib/db");
  const { handleGenerateCourseThumbnailJob } = await import("@/worker/handlers/courseThumbnail");
  const { handleGenerateSchoolOnboardingKitJob } = await import("@/worker/handlers/onboardingKit");
  const { handleGenerateCertificationAssetsJob } = await import("@/worker/handlers/certificationAssets");

  const healthResponse = await GET();
  const healthBody = await healthResponse.json();
  checks.push({
    name: "/api/health/canva healthy",
    ok: healthResponse.status === 200 && healthBody.ok === true,
    detail: `status=${healthResponse.status} anthropic=${healthBody.anthropicEnvDetected} canva=${healthBody.canvaMcpConfigured}`,
  });
  checks.push({
    name: "/api/health/canva server-only secret handling",
    ok: healthBody.serverSideOnly === true && !JSON.stringify(healthBody).match(/sk-|API_KEY|HIGGSFIELD_CREDENTIALS|ANTHROPIC_API_KEY/),
  });
  checks.push({
    name: "/api/health/canva feature flags",
    ok:
      healthBody.featureFlags?.canvaCourseThumbnails === true &&
      healthBody.featureFlags?.schoolOnboardingKits === true &&
      healthBody.featureFlags?.certificationAssetGeneration === true &&
      healthBody.featureFlags?.higgsfieldVideoGeneration === true,
    detail: JSON.stringify(healthBody.featureFlags),
  });

  const actor = await prisma.user.upsert({
    where: { email: `${runId}-actor@example.test` },
    update: {},
    create: {
      email: `${runId}-actor@example.test`,
      name: "Asset Pipeline Verifier",
      role: "ADMIN",
      isPlatformAdmin: true,
    },
  });

  const school = await prisma.school.create({
    data: {
      name: `Asset Pipeline Test School ${runId}`,
      code: `APL${Date.now().toString().slice(-7)}`,
      county: "Montserrado",
      district: "Greater Monrovia",
      contactName: "Pipeline Principal",
      contactEmail: `${runId}-principal@example.test`,
      status: "ACTIVE",
      onboardingKitStatus: "pending",
    },
  });

  const course = await prisma.curriculumContent.upsert({
    where: { contentId: `${runId}-course` },
    update: {
      thumbnailUrl: null,
      thumbnailStatus: "pending",
      thumbnailError: null,
    },
    create: {
      contentId: `${runId}-course`,
      title: "Live Asset Pipeline Mathematics",
      grade: 9,
      subject: "MATH",
      contentType: "lesson",
      status: "approved",
      version: "live-verify",
      payload: { title: "Live Asset Pipeline Mathematics", body: "Safe verification lesson." },
    },
  });

  await handleGenerateCourseThumbnailJob({
    contentId: course.contentId,
    schoolId: school.id,
    actorUserId: actor.id,
  });
  const courseAfter = await prisma.curriculumContent.findUnique({
    where: { contentId: course.contentId },
    select: { thumbnailUrl: true, thumbnailStatus: true },
  });
  const courseAudit = await prisma.auditLog.findFirst({
    where: {
      action: "course.thumbnail.generated",
      resourceId: course.contentId,
      schoolId: school.id,
    },
  });
  checks.push({
    name: "Course thumbnail generation persisted URL",
    ok: Boolean(courseAfter?.thumbnailUrl?.startsWith("https://www.canva.com/design/")) && courseAfter?.thumbnailStatus === "completed",
    detail: `status=${courseAfter?.thumbnailStatus}`,
  });
  checks.push({ name: "Course thumbnail audit event exists", ok: Boolean(courseAudit) });

  await handleGenerateSchoolOnboardingKitJob({ schoolId: school.id, actorUserId: actor.id });
  const schoolAfter = await prisma.school.findUnique({
    where: { id: school.id },
    select: { onboardingKitStatus: true, onboardingKitUrl: true },
  });
  const onboardingAudit = await prisma.auditLog.findMany({
    where: {
      schoolId: school.id,
      action: { in: ["school.onboarding_kit.processing", "school.onboarding_kit.completed", "school.onboarding_kit.failed"] },
    },
    select: { action: true },
  });
  checks.push({
    name: "School onboarding kit lifecycle",
    ok:
      onboardingAudit.some((entry) => entry.action === "school.onboarding_kit.processing") &&
      ["completed", "failed"].includes(schoolAfter?.onboardingKitStatus ?? ""),
    detail: `status=${schoolAfter?.onboardingKitStatus}`,
  });
  checks.push({
    name: "School onboarding kit URL persisted on success",
    ok:
      schoolAfter?.onboardingKitStatus === "failed" ||
      Boolean(schoolAfter?.onboardingKitUrl?.startsWith("https://www.canva.com/design/")),
  });

  const studentUser = await prisma.user.create({
    data: {
      email: `${runId}-student@example.test`,
      name: "Pipeline Student",
      role: "STUDENT",
      schoolId: school.id,
    },
  });
  const student = await prisma.student.create({
    data: {
      userId: studentUser.id,
      currentGrade: 10,
    },
  });
  const exam = await prisma.exam.create({
    data: {
      title: "Live Asset Pipeline Certification",
      subject: "SCIENCE",
      grade: 10,
      schoolId: school.id,
      createdBy: actor.id,
      status: "PUBLISHED",
      moeStandards: [],
      timeLimit: 30,
      passingScore: 0.7,
      publishedAt: new Date(),
    },
  });
  const certification = await prisma.examCertification.create({
    data: {
      studentId: student.id,
      examId: exam.id,
      subject: "SCIENCE",
      grade: 10,
      score: 0.95,
      certCode: randomUUID().replace(/-/g, "").slice(0, 12),
      assetGenerationStatus: "pending",
    },
  });

  let certificationError: string | null = null;
  try {
    await handleGenerateCertificationAssetsJob({
      certificationId: certification.id,
      actorUserId: actor.id,
    });
  } catch (error) {
    certificationError = error instanceof Error ? error.message : String(error);
  }

  const certAfter = await prisma.examCertification.findUnique({
    where: { id: certification.id },
    select: { bannerUrl: true, videoUrl: true, assetGenerationStatus: true },
  });
  const certAudit = await prisma.auditLog.findFirst({
    where: {
      resourceType: "examCertification",
      resourceId: certification.id,
      schoolId: school.id,
      action: { in: ["certification.assets.generated", "certification.assets.failed"] },
    },
  });
  checks.push({
    name: "Certification Canva banner generation",
    ok: Boolean(certAfter?.bannerUrl?.startsWith("https://www.canva.com/design/")),
    detail: `status=${certAfter?.assetGenerationStatus}`,
  });
  checks.push({
    name: "Higgsfield video generation",
    ok: Boolean(certAfter?.videoUrl),
    detail: certificationError ?? "no error",
  });
  checks.push({
    name: "Certification asset status is structured",
    ok: ["completed", "failed"].includes(certAfter?.assetGenerationStatus ?? ""),
    detail: `status=${certAfter?.assetGenerationStatus}`,
  });
  checks.push({ name: "Certification tenant-scoped audit exists", ok: Boolean(certAudit) });

  const telemetryCount = await prisma.aIInteraction.count({
    where: {
      route: { in: ["worker.courseThumbnail", "worker.onboardingKit", "worker.certificationAssets"] },
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  checks.push({ name: "Asset generation telemetry persisted", ok: telemetryCount >= 3, detail: `count=${telemetryCount}` });

  const tenantLeak = await prisma.auditLog.findFirst({
    where: {
      resourceId: { in: [course.contentId, school.id, certification.id] },
      schoolId: { not: school.id },
    },
  });
  checks.push({ name: "No audit tenant leakage for test resources", ok: !tenantLeak });

  for (const check of checks) printCheck(check);

  const failed = checks.filter((check) => !check.ok);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    const { prisma } = await import("@/lib/db");
    await prisma.$disconnect();
  });
