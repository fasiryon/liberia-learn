import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockGetProductMetricsDashboard = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/reporting/productMetrics", () => ({
  getProductMetricsDashboard: mockGetProductMetricsDashboard,
}));

import { GET } from "@/app/api/admin/metrics/product/route";

describe("GET /api/admin/metrics/product", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAudit.mockResolvedValue(undefined);
    mockGetProductMetricsDashboard.mockResolvedValue({
      generatedAt: "2026-04-03T00:00:00.000Z",
      scope: "school",
      period: "30d",
      learningOutcomes: {
        lessonCompletionRate: { value: 81, previousValue: 77, delta: 4, trend: "up" },
        examCompletionRate: { value: 72, previousValue: 71, delta: 1, trend: "up" },
        examPassRate: { value: 68, previousValue: 66, delta: 2, trend: "up" },
        avgExamScore: { value: 64, previousValue: 61, delta: 3, trend: "up" },
        masteryProgressRate: { value: 59, previousValue: 56, delta: 3, trend: "up" },
      },
      engagement: {
        assignmentSubmissionRate: { value: 74, previousValue: 69, delta: 5, trend: "up" },
        guardianEngagementRate: { value: 28, previousValue: 24, delta: 4, trend: "up" },
        aiTutorAdoptionRate: { value: 42, previousValue: 38, delta: 4, trend: "up" },
        teacherAiAssistAdoptionRate: { value: 63, previousValue: 59, delta: 4, trend: "up" },
        interventionAcceptanceRate: { value: 51, previousValue: 49, delta: 2, trend: "up" },
      },
      platformMetrics: {
        moeExportCount: { value: 3, previousValue: 2, delta: 1, trend: "up" },
        activeStudentsPercent: { value: 61, previousValue: 57, delta: 4, trend: "up" },
        activeTeachersPercent: { value: 84, previousValue: 82, delta: 2, trend: "up" },
      },
      nationalOutcomes: null,
    });
  });

  it("returns school-scoped metrics for a school admin", async () => {
    mockRequireUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await GET(new Request("http://localhost/api/admin/metrics/product?period=7d") as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetProductMetricsDashboard).toHaveBeenCalledWith({
      period: "7d",
      schoolId: "school-1",
    });
    expect(body.learningOutcomes.lessonCompletionRate.value).toBe(81);
  });

  it("allows platform admin to request national metrics without a school id", async () => {
    mockRequireUser.mockResolvedValue({
      id: "platform-1",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });
    mockGetProductMetricsDashboard.mockResolvedValueOnce({
      ...(await mockGetProductMetricsDashboard()),
      scope: "national",
      nationalOutcomes: {
        nationalLessonCompletionRate: 81,
        nationalExamPassRate: 68,
        nationalGuardianEngagementRate: 28,
        interventionImpactRate: 51,
        topPerformingDistricts: [],
        lowestPerformingDistricts: [],
      },
    });

    const res = await GET(new Request("http://localhost/api/admin/metrics/product") as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockGetProductMetricsDashboard).toHaveBeenCalledWith({
      period: "30d",
      schoolId: null,
    });
    expect(body.scope).toBe("national");
  });

  it("rejects unauthorized roles", async () => {
    mockRequireUser.mockResolvedValue({
      id: "teacher-1",
      role: "TEACHER",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await GET(new Request("http://localhost/api/admin/metrics/product") as any);
    expect(res.status).toBe(403);
    expect(mockGetProductMetricsDashboard).not.toHaveBeenCalled();
  });

  it("returns 400 when a school admin has no school scope", async () => {
    mockRequireUser.mockResolvedValue({
      id: "admin-2",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: false,
    });

    const res = await GET(new Request("http://localhost/api/admin/metrics/product") as any);
    expect(res.status).toBe(400);
  });
});
