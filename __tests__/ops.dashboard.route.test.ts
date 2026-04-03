import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
}));

const { getOpsDashboardDataMock } = vi.hoisted(() => ({
  getOpsDashboardDataMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/ops/dashboard", () => ({
  getOpsDashboardData: getOpsDashboardDataMock,
}));

import { GET } from "@/app/api/admin/ops/dashboard/route";

describe("ops dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-platform admins", async () => {
    requireUserMock.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(getOpsDashboardDataMock).not.toHaveBeenCalled();
  });

  it("returns the aggregated payload for platform admins", async () => {
    requireUserMock.mockResolvedValue({
      id: "platform-admin-1",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });
    getOpsDashboardDataMock.mockResolvedValue({
      timestamp: "2026-04-03T18:00:00.000Z",
      build: { version: "1.0.0", commitSha: "abc123", environment: "production" },
      health: { db: "healthy", dbLatencyMs: 80, rateLimitBackend: "memory", sentryConfigured: false, workerQueueDepth: null },
      slo: {
        login: { current: 0.99, target: 0.995, status: "degraded" },
        tutor: { current: 0.97, target: 0.95, status: "healthy" },
        submit: { current: 1, target: 0.99, status: "healthy" },
        export: { current: 1, target: 0.98, status: "healthy" },
      },
      ai: { totalRequestsToday: 12, fallbackRatePercent: 8.3, estimatedCostUsdToday: 1.2345 },
      users: { activeStudentsToday: 33, activeTeachersToday: 4, totalSchools: 3 },
      errors: { count5xxLast24h: 2 },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.build.version).toBe("1.0.0");
    expect(body.slo.login.status).toBe("degraded");
    expect(getOpsDashboardDataMock).toHaveBeenCalledOnce();
  });
});
