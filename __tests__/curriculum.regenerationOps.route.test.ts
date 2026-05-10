import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePlatformAdminMock, opsDataMock } = vi.hoisted(() => ({
  requirePlatformAdminMock: vi.fn(),
  opsDataMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requirePlatformAdmin: requirePlatformAdminMock }));
vi.mock("@/lib/curriculum/regenerationAdmin", () => ({
  getCurriculumRegenerationOpsData: opsDataMock,
}));

import { GET } from "@/app/api/admin/ops/curriculum-regeneration/route";

describe("curriculum regeneration ops route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires platform admin access", async () => {
    requirePlatformAdminMock.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(opsDataMock).not.toHaveBeenCalled();
  });

  it("returns regeneration ops data", async () => {
    requirePlatformAdminMock.mockResolvedValue({ id: "platform-1", isPlatformAdmin: true });
    opsDataMock.mockResolvedValue({ queueDepth: { total: 0 }, qa: { approvedThinCount: 0 } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.queueDepth.total).toBe(0);
  });
});

