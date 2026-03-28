import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIsConfusionDetectionEnabled = vi.hoisted(() => vi.fn());
const mockConfusionSignalFindFirst = vi.hoisted(() => vi.fn());
const mockConfusionSignalCreate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/serverFlags", () => ({
  isConfusionDetectionEnabled: mockIsConfusionDetectionEnabled,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    confusionSignal: {
      findFirst: mockConfusionSignalFindFirst,
      create: mockConfusionSignalCreate,
    },
  },
}));

import { detectConfusion } from "@/lib/intelligence/confusionDetector";

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    studentId: "student-1",
    lessonId: "lesson-1",
    subject: "MATH",
    gradeLevel: 7,
    eventType: "practice_attempt",
    score: 0.8,
    durationSeconds: 300,
    attempts: 1,
    aiAssistUsed: false,
    schoolId: "school-1",
    createdAt: new Date(),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfusionDetectionEnabled.mockReturnValue(true);
  mockConfusionSignalFindFirst.mockResolvedValue(null);
  mockConfusionSignalCreate.mockImplementation(async ({ data }) => ({
    id: `${data.confusionType}-1`,
    ...data,
  }));
});

describe("detectConfusion", () => {
  it("returns empty array when no events", async () => {
    await expect(detectConfusion("student-1", "school-1", [])).resolves.toEqual([]);
  });

  it("detects repeat_attempts when attempts > 3", async () => {
    const result = await detectConfusion("student-1", "school-1", [makeEvent({ attempts: 4 })]);
    expect(result.some((signal) => signal.confusionType === "repeat_attempts")).toBe(true);
  });

  it("detects low_score when score < 0.5", async () => {
    const result = await detectConfusion("student-1", "school-1", [makeEvent({ score: 0.4 })]);
    expect(result.some((signal) => signal.confusionType === "low_score")).toBe(true);
  });

  it("assigns high severity when score < 0.3", async () => {
    const result = await detectConfusion("student-1", "school-1", [makeEvent({ score: 0.2 })]);
    expect(result.find((signal) => signal.confusionType === "low_score")?.severity).toBe("high");
  });

  it("detects long_duration when > 900s", async () => {
    const result = await detectConfusion(
      "student-1",
      "school-1",
      [makeEvent({ durationSeconds: 1200 })]
    );
    expect(result.some((signal) => signal.confusionType === "long_duration")).toBe(true);
  });

  it("detects ai_dependency on 3+ consecutive AI uses", async () => {
    const result = await detectConfusion("student-1", "school-1", [
      makeEvent({ aiAssistUsed: true }),
      makeEvent({ aiAssistUsed: true, id: "event-2" }),
      makeEvent({ aiAssistUsed: true, id: "event-3" }),
    ]);
    expect(result.some((signal) => signal.confusionType === "ai_dependency")).toBe(true);
  });

  it("does not create duplicate signals within 24h", async () => {
    mockConfusionSignalFindFirst.mockResolvedValue({ id: "existing" });
    const result = await detectConfusion("student-1", "school-1", [makeEvent({ score: 0.2 })]);
    expect(result).toEqual([]);
    expect(mockConfusionSignalCreate).not.toHaveBeenCalled();
  });

  it("returns empty when ENABLE_CONFUSION_DETECTION is off", async () => {
    mockIsConfusionDetectionEnabled.mockReturnValue(false);
    await expect(detectConfusion("student-1", "school-1", [makeEvent({ score: 0.2 })])).resolves.toEqual([]);
  });
});
