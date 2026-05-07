import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCurriculumFindUnique = vi.hoisted(() => vi.fn());
const mockCurriculumUpdate = vi.hoisted(() => vi.fn());
const mockSchoolFindUnique = vi.hoisted(() => vi.fn());
const mockSchoolUpdate = vi.hoisted(() => vi.fn());
const mockCertificationFindUnique = vi.hoisted(() => vi.fn());
const mockCertificationUpdate = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockGenerateCourseThumbnail = vi.hoisted(() => vi.fn());
const mockGenerateOnboardingKit = vi.hoisted(() => vi.fn());
const mockGenerateCertificationBanner = vi.hoisted(() => vi.fn());
const mockGenerateHiggsfieldPromoVideo = vi.hoisted(() => vi.fn());
const mockSendSchoolOnboardingKit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: {
    curriculumContent: {
      findUnique: mockCurriculumFindUnique,
      update: mockCurriculumUpdate,
    },
    school: {
      findUnique: mockSchoolFindUnique,
      update: mockSchoolUpdate,
    },
    examCertification: {
      findUnique: mockCertificationFindUnique,
      update: mockCertificationUpdate,
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/courses/generateCourseThumbnail", () => ({ generateCourseThumbnail: mockGenerateCourseThumbnail }));
vi.mock("@/lib/schools/generateOnboardingKit", () => ({ generateOnboardingKit: mockGenerateOnboardingKit }));
vi.mock("@/lib/certifications/generateCertificationAssets", () => ({
  generateCertificationBanner: mockGenerateCertificationBanner,
  generateHiggsfieldPromoVideo: mockGenerateHiggsfieldPromoVideo,
}));
vi.mock("@/lib/email", () => ({ sendSchoolOnboardingKit: mockSendSchoolOnboardingKit }));
vi.mock("@/lib/serverFlags", () => ({
  isCanvaCourseThumbnailsEnabled: () => true,
  isSchoolOnboardingKitsEnabled: () => true,
  isCertificationAssetGenerationEnabled: () => true,
  isHiggsfieldVideoGenerationEnabled: () => true,
}));

import { handleGenerateCertificationAssetsJob } from "@/worker/handlers/certificationAssets";
import { handleGenerateCourseThumbnailJob } from "@/worker/handlers/courseThumbnail";
import { handleGenerateSchoolOnboardingKitJob } from "@/worker/handlers/onboardingKit";

describe("asset generation worker handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurriculumUpdate.mockResolvedValue({});
    mockSchoolUpdate.mockResolvedValue({});
    mockCertificationUpdate.mockResolvedValue({});
    mockLogAudit.mockResolvedValue(undefined);
    mockSendSchoolOnboardingKit.mockResolvedValue({ ok: true });
  });

  it("persists a course thumbnail URL on success and records tenant-scoped audit", async () => {
    mockCurriculumFindUnique.mockResolvedValue({
      contentId: "course-1",
      title: "Algebra Basics",
      subject: "MATH",
      grade: 9,
      payload: {},
    });
    mockSchoolFindUnique.mockResolvedValue({ name: "Test School" });
    mockGenerateCourseThumbnail.mockResolvedValue({
      canvaUrl: "https://www.canva.com/design/test-course",
      designId: "test-course",
    });

    await handleGenerateCourseThumbnailJob(
      { contentId: "course-1", schoolId: "school-1", actorUserId: "admin-1" },
      { enqueuedAt: new Date(Date.now() - 1000).toISOString(), retryCount: 1 }
    );

    expect(mockGenerateCourseThumbnail).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "school-1",
      queueWaitMs: expect.any(Number),
      retryCount: 1,
    }));
    expect(mockCurriculumUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { contentId: "course-1" },
      data: expect.objectContaining({
        thumbnailUrl: "https://www.canva.com/design/test-course",
        thumbnailStatus: "completed",
      }),
    }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-1",
      action: "course.thumbnail.generated",
    }));
  });

  it("moves onboarding kit status through processing to completed and invokes principal email safely", async () => {
    mockSchoolFindUnique.mockResolvedValue({
      id: "school-1",
      name: "Pipeline Test School",
      county: "Montserrado",
      contactName: "Principal",
      contactEmail: "principal@example.test",
      code: "ABC123",
    });
    mockGenerateOnboardingKit.mockResolvedValue({ canvaUrl: "https://www.canva.com/design/test-kit" });

    await handleGenerateSchoolOnboardingKitJob({ schoolId: "school-1", actorUserId: "admin-1" });

    expect(mockSchoolUpdate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: { onboardingKitStatus: "processing" },
    }));
    expect(mockSchoolUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        onboardingKitUrl: "https://www.canva.com/design/test-kit",
        onboardingKitStatus: "completed",
      }),
    }));
    expect(mockSendSchoolOnboardingKit).toHaveBeenCalledWith(expect.objectContaining({
      to: "principal@example.test",
      kitUrl: "https://www.canva.com/design/test-kit",
    }));
  });

  it("persists successful certification banner when video generation partially fails", async () => {
    mockCertificationFindUnique.mockResolvedValue({
      id: "cert-1",
      subject: "SCIENCE",
      grade: 10,
      exam: { title: "Science Pathway", schoolId: "school-1" },
    });
    mockGenerateCertificationBanner.mockResolvedValue({ canvaUrl: "https://www.canva.com/design/test-banner" });
    mockGenerateHiggsfieldPromoVideo.mockRejectedValue(new Error("Higgsfield generation failed"));

    await expect(
      handleGenerateCertificationAssetsJob({ certificationId: "cert-1", actorUserId: "moe-1" })
    ).rejects.toThrow("partially failed");

    expect(mockCertificationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "cert-1" },
      data: expect.objectContaining({
        bannerUrl: "https://www.canva.com/design/test-banner",
        assetGenerationStatus: "failed",
      }),
    }));
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({
      schoolId: "school-1",
      action: "certification.assets.failed",
      details: expect.objectContaining({
        hasBanner: true,
        hasVideo: false,
      }),
    }));
  });
});
