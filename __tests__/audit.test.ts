import { describe, it, expect, vi } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "test-id" }),
    },
  },
}));

import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

describe("logAudit", () => {
  it("creates an audit log entry", async () => {
    await logAudit({
      userId: "user-1",
      action: "test.action",
      resourceType: "test",
      resourceId: "res-1",
      details: { foo: "bar" },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        action: "test.action",
        resourceType: "test",
        resourceId: "res-1",
        details: { foo: "bar" },
        ipAddress: null,
      }),
    });
  });

  it("handles null userId gracefully", async () => {
    await logAudit({
      action: "system.startup",
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        action: "system.startup",
      }),
    });
  });

  it("does not throw on error", async () => {
    (prisma.auditLog.create as any).mockRejectedValueOnce(new Error("DB error"));

    // Should not throw
    await expect(
      logAudit({ action: "fail.test" })
    ).resolves.not.toThrow();
  });
});

