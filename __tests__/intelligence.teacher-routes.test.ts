import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockIsConfusionDetectionEnabled = vi.hoisted(() => vi.fn());
const mockIsInterventionEngineEnabled = vi.hoisted(() => vi.fn());
const mockGetClassPerformanceSummary = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockConfusionFindMany = vi.hoisted(() => vi.fn());
const mockInterventionFindMany = vi.hoisted(() => vi.fn());
const mockInterventionUpdateMany = vi.hoisted(() => vi.fn());
const mockInterventionFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/serverFlags", () => ({
  isConfusionDetectionEnabled: mockIsConfusionDetectionEnabled,
  isInterventionEngineEnabled: mockIsInterventionEngineEnabled,
}));
vi.mock("@/lib/intelligence/performanceAggregator", () => ({
  getClassPerformanceSummary: mockGetClassPerformanceSummary,
}));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/db", () => ({
  prisma: {
    confusionSignal: { findMany: mockConfusionFindMany },
    interventionRecommendation: {
      findMany: mockInterventionFindMany,
      updateMany: mockInterventionUpdateMany,
      findFirst: mockInterventionFindFirst,
    },
  },
}));

import { GET as performanceGET } from "@/app/api/teacher/performance/route";
import { GET as confusionsGET } from "@/app/api/teacher/confusions/route";
import {
  GET as interventionsGET,
  PATCH as interventionsPATCH,
} from "@/app/api/teacher/interventions/route";

const teacherUser = { id: "teacher-1", role: "TEACHER", schoolId: "school-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue(teacherUser);
  mockIsConfusionDetectionEnabled.mockReturnValue(true);
  mockIsInterventionEngineEnabled.mockReturnValue(true);
  mockGetClassPerformanceSummary.mockResolvedValue({ teacherId: "teacher-1", schoolId: "school-1" });
  mockConfusionFindMany.mockResolvedValue([{ id: "signal-1", severity: "high", detectedAt: new Date().toISOString() }]);
  mockInterventionFindMany.mockResolvedValue([{ id: "int-1", status: "pending" }]);
  mockInterventionUpdateMany.mockResolvedValue({ count: 1 });
  mockInterventionFindFirst.mockResolvedValue({ id: "int-1", status: "actioned" });
  mockLogAudit.mockResolvedValue(undefined);
});

describe("teacher intelligence routes", () => {
  it("GET /api/teacher/performance requires TEACHER session", async () => {
    mockRequireUser.mockResolvedValue({ id: "guardian-1", role: "GUARDIAN", schoolId: "school-1" });
    const res = await performanceGET();
    expect(res.status).toBe(403);
  });

  it("GET /api/teacher/confusions requires TEACHER session", async () => {
    mockRequireUser.mockResolvedValue({ id: "student-1", role: "STUDENT", schoolId: "school-1" });
    const res = await confusionsGET(new Request("http://localhost/api/teacher/confusions") as any);
    expect(res.status).toBe(403);
  });

  it("GET /api/teacher/confusions filters by studentId when provided", async () => {
    await confusionsGET(new Request("http://localhost/api/teacher/confusions?studentId=student-9") as any);
    expect(mockConfusionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: "school-1", studentId: "student-9" },
        take: 50,
      })
    );
  });

  it("PATCH /api/teacher/interventions updates status", async () => {
    const req = new Request("http://localhost/api/teacher/interventions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "int-1", status: "actioned" }),
    }) as any;
    const res = await interventionsPATCH(req);
    expect(res.status).toBe(200);
    expect(mockInterventionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "int-1", schoolId: "school-1" },
        data: { status: "actioned" },
      })
    );
  });

  it("all routes return 404 when flags are off", async () => {
    mockIsConfusionDetectionEnabled.mockReturnValue(false);
    mockIsInterventionEngineEnabled.mockReturnValue(false);
    expect((await performanceGET()).status).toBe(404);
    expect((await confusionsGET(new Request("http://localhost/api/teacher/confusions") as any)).status).toBe(404);
    expect((await interventionsGET()).status).toBe(404);
  });

  it("no cross-tenant data leakage", async () => {
    await interventionsGET();
    expect(mockInterventionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { schoolId: "school-1", status: "pending" },
      })
    );
  });
});
