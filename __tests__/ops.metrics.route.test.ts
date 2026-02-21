import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRoleMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
}));

const { aggregateMetricsMock } = vi.hoisted(() => ({
  aggregateMetricsMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/metrics/events", () => ({
  aggregateMetrics: aggregateMetricsMock,
}));

import { GET } from "@/app/api/admin/ops/metrics/summary/route";

describe("ops metrics summary route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enforces RBAC/scope for non-platform admins", async () => {
    requireRoleMock.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
      isPlatformAdmin: false,
    });

    const req = new Request(
      "http://localhost/api/admin/ops/metrics/summary?scope=county&scopeId=Montserrado&range=7d"
    );
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(aggregateMetricsMock).not.toHaveBeenCalled();
  });
});
