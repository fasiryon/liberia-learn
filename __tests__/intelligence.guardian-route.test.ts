import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsConfusionDetectionEnabled = vi.hoisted(() => vi.fn());
const mockIsGuardianProgressViewEnabled = vi.hoisted(() => vi.fn());
const mockStudentGuardianFindFirst = vi.hoisted(() => vi.fn());
const mockGetStudentPerformanceSummary = vi.hoisted(() => vi.fn());
const mockInterventionCount = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/serverFlags", () => ({
  isConfusionDetectionEnabled: mockIsConfusionDetectionEnabled,
  isGuardianProgressViewEnabled: mockIsGuardianProgressViewEnabled,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    studentGuardian: { findFirst: mockStudentGuardianFindFirst },
    interventionRecommendation: { count: mockInterventionCount },
  },
}));
vi.mock("@/lib/intelligence/performanceAggregator", () => ({
  getStudentPerformanceSummary: mockGetStudentPerformanceSummary,
}));

import { GET } from "@/app/api/guardian/performance/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "guardian-1", role: "GUARDIAN", schoolId: "school-1" });
  mockIsConfusionDetectionEnabled.mockReturnValue(true);
  mockIsGuardianProgressViewEnabled.mockReturnValue(true);
  mockStudentGuardianFindFirst.mockResolvedValue({ studentId: "student-1" });
  mockGetStudentPerformanceSummary.mockResolvedValue({
    studentId: "student-1",
    avgScore: 0.72,
    masteryLevel: "proficient",
    improvementTrend: "improving",
    confusionCount: 3,
    pendingInterventions: 2,
  });
  mockInterventionCount.mockResolvedValue(1);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("GET /api/guardian/performance", () => {
  it("returns limited summary for guardian's student", async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({
      avgScore: 0.72,
      masteryLevel: "proficient",
      improvementTrend: "improving",
      hasSuggestedSupport: true,
    });
  });

  it("does not expose raw ConfusionSignal data", async () => {
    const data = await (await GET()).json();
    expect(data.confusionSignals).toBeUndefined();
  });

  it("does not expose confusionCount", async () => {
    const data = await (await GET()).json();
    expect(data.confusionCount).toBeUndefined();
  });

  it("requires GUARDIAN session", async () => {
    mockRequireUser.mockResolvedValue({ id: "teacher-1", role: "TEACHER", schoolId: "school-1" });
    const res = await GET();
    expect(res.status).toBe(403);
  });
});
