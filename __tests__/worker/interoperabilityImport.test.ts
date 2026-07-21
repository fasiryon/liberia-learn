import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  processStudentImportBatch: vi.fn(),
  processOneRosterImportBatch: vi.fn(),
}));

vi.mock("@/lib/school-operations", () => ({
  processStudentImportBatch: mocks.processStudentImportBatch,
}));
vi.mock("@/lib/interoperability/onerosterService", () => ({
  processOneRosterImportBatch: mocks.processOneRosterImportBatch,
}));
vi.mock("@/worker/handlers/analytics", () => ({ handleSnapshotAnalyticsJob: vi.fn() }));
vi.mock("@/worker/handlers/certificationAssets", () => ({ handleGenerateCertificationAssetsJob: vi.fn() }));
vi.mock("@/worker/handlers/courseThumbnail", () => ({ handleGenerateCourseThumbnailJob: vi.fn() }));
vi.mock("@/worker/handlers/embeddings", () => ({ handleGenerateEmbeddingsJob: vi.fn() }));
vi.mock("@/worker/handlers/intelligence", () => ({ handleConfusionDetectionJob: vi.fn() }));
vi.mock("@/worker/handlers/onboardingKit", () => ({ handleGenerateSchoolOnboardingKitJob: vi.fn() }));
vi.mock("@/worker/handlers/sms", () => ({ handleSendSmsJob: vi.fn() }));
vi.mock("@/worker/handlers/textbook", () => ({ handleGenerateTextbookJob: vi.fn() }));
vi.mock("@/worker/handlers/curriculumRegeneration", () => ({
  handleCurriculumRegenerationGroupJob: vi.fn(),
  handleCurriculumRegenerationLessonJob: vi.fn(),
  handleCurriculumRegenerationResumeJob: vi.fn(),
}));

import { JobType } from "@/lib/queue";
import { dispatchJob } from "@/worker/handlers";
import { handleOneRosterImportJob } from "@/worker/handlers/oneRosterImport";
import { handleStudentImportJob } from "@/worker/handlers/studentImport";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.processStudentImportBatch.mockResolvedValue({ status: "COMPLETED" });
  mocks.processOneRosterImportBatch.mockResolvedValue({ status: "COMPLETED" });
});

describe("import worker handlers", () => {
  it("passes a trimmed school scope into the student import processor", async () => {
    await handleStudentImportJob({ batchId: " batch-1 ", schoolId: " school-1 " });

    expect(mocks.processStudentImportBatch).toHaveBeenCalledWith("batch-1", "school-1");
  });

  it("rejects a OneRoster job without an explicit school scope", async () => {
    await expect(handleOneRosterImportJob({ batchId: "batch-1" })).rejects.toThrow(
      "ONEROSTER_IMPORT requires batchId and schoolId"
    );
    expect(mocks.processOneRosterImportBatch).not.toHaveBeenCalled();
  });

  it("dispatches STUDENT_IMPORT to real processing instead of acknowledging a no-op", async () => {
    await dispatchJob(JobType.STUDENT_IMPORT, { batchId: "batch-1", schoolId: "school-1" });

    expect(mocks.processStudentImportBatch).toHaveBeenCalledWith("batch-1", "school-1");
  });

  it("dispatches ONEROSTER_IMPORT with the expected tenant scope", async () => {
    await dispatchJob(JobType.ONEROSTER_IMPORT, { batchId: "batch-2", schoolId: "school-2" });

    expect(mocks.processOneRosterImportBatch).toHaveBeenCalledWith("batch-2", "school-2");
  });
});
