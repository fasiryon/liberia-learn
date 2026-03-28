import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsInterventionEngineEnabled = vi.hoisted(() => vi.fn());
const mockInterventionFindFirst = vi.hoisted(() => vi.fn());
const mockInterventionCreate = vi.hoisted(() => vi.fn());
const mockStudentGuardianFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/serverFlags", () => ({
  isInterventionEngineEnabled: mockIsInterventionEngineEnabled,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    interventionRecommendation: {
      findFirst: mockInterventionFindFirst,
      create: mockInterventionCreate,
    },
    studentGuardian: {
      findFirst: mockStudentGuardianFindFirst,
    },
  },
}));

import { runInterventionCheck } from "@/lib/intelligence/interventionEngine";

function makeSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: "signal-1",
    studentId: "student-1",
    lessonId: "lesson-1",
    conceptTag: "MATH::lesson-1",
    confusionType: "low_score",
    severity: "high",
    schoolId: "school-1",
    detectedAt: new Date(),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsInterventionEngineEnabled.mockReturnValue(true);
  mockInterventionFindFirst.mockResolvedValue(null);
  mockInterventionCreate.mockImplementation(async ({ data }) => ({ id: `${data.recommendationType}-1`, ...data }));
  mockStudentGuardianFindFirst.mockResolvedValue(null);
});

describe("runInterventionCheck", () => {
  it("maps high severity low_score to extra_practice", async () => {
    const result = await runInterventionCheck("student-1", "school-1", [makeSignal()]);
    expect(result.some((entry) => entry.recommendationType === "extra_practice")).toBe(true);
  });

  it("maps long_duration to review", async () => {
    const result = await runInterventionCheck("student-1", "school-1", [
      makeSignal({ confusionType: "long_duration", severity: "low" }),
    ]);
    expect(result.some((entry) => entry.recommendationType === "review")).toBe(true);
  });

  it("maps 2+ high signals to teacher_attention", async () => {
    const result = await runInterventionCheck("student-1", "school-1", [
      makeSignal({ conceptTag: "MATH::lesson-1" }),
      makeSignal({ id: "signal-2", conceptTag: "MATH::lesson-2", confusionType: "repeat_attempts" }),
    ]);
    expect(result.some((entry) => entry.recommendationType === "teacher_attention")).toBe(true);
  });

  it("creates guardian_support when student has guardian", async () => {
    mockStudentGuardianFindFirst.mockResolvedValue({ id: "guardian-link" });
    const result = await runInterventionCheck("student-1", "school-1", [
      makeSignal({ conceptTag: "MATH::lesson-1" }),
      makeSignal({ id: "signal-2", conceptTag: "MATH::lesson-2", confusionType: "repeat_attempts" }),
    ]);
    expect(result.some((entry) => entry.recommendationType === "guardian_support")).toBe(true);
  });

  it("does not create duplicate pending interventions", async () => {
    mockInterventionFindFirst.mockResolvedValue({ id: "existing" });
    const result = await runInterventionCheck("student-1", "school-1", [makeSignal()]);
    expect(result).toEqual([]);
    expect(mockInterventionCreate).not.toHaveBeenCalled();
  });

  it("returns empty when ENABLE_INTERVENTION_ENGINE is off", async () => {
    mockIsInterventionEngineEnabled.mockReturnValue(false);
    await expect(runInterventionCheck("student-1", "school-1", [makeSignal()])).resolves.toEqual([]);
  });
});
