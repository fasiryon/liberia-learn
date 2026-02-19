import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    school: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: { count: vi.fn() },
    class: { count: vi.fn() },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

import { PATCH } from "@/app/api/admin/onboarding/route";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

describe("admin onboarding PATCH", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (requireRole as any).mockResolvedValue({ id: "u1", schoolId: "s1", role: "ADMIN" });
    (prisma.school.findUnique as any).mockResolvedValue({ id: "s1", onboardingStep: 0 });
  });

  it("rejects missing required fields", async () => {
    const req = new Request("http://localhost/api/admin/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ step: 1, data: { name: "Test School", county: "Bong" } }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("District is required");
    expect(prisma.school.update).not.toHaveBeenCalled();
  });

  it("accepts valid step 1 payload", async () => {
    (prisma.school.update as any).mockResolvedValue({ id: "s1" });

    const req = new Request("http://localhost/api/admin/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 1,
        data: {
          name: "Test School",
          county: "Bong",
          district: "Central",
          contactEmail: "admin@test.edu.lr",
          contactPhone: "+231770000000",
          motto: "Learn",
          contactName: "Principal",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.school.update).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        schoolId: "s1",
        action: "onboarding.step_completed",
        details: { step: { from: 0, to: 1 } },
      })
    );
  });

  it("does not log when step does not advance", async () => {
    (prisma.school.findUnique as any).mockResolvedValue({ id: "s1", onboardingStep: 2 });
    (prisma.school.update as any).mockResolvedValue({ id: "s1" });

    const req = new Request("http://localhost/api/admin/onboarding", {
      method: "PATCH",
      body: JSON.stringify({
        step: 1,
        data: {
          name: "Test School",
          county: "Bong",
          district: "Central",
          contactEmail: "admin@test.edu.lr",
          contactPhone: "+231770000000",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await PATCH(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.school.update).toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });
});
