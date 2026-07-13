import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { studentGuardian: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { assertGuardianOf } from "@/lib/agents/tools/guardianAuth";

describe("assertGuardianOf", () => {
  beforeEach(() => {
    mockPrisma.studentGuardian.findUnique.mockReset();
  });

  it("throws 401 when ctx.userId is not set", async () => {
    await expect(assertGuardianOf({ agentName: "x", userId: null }, "student-1")).rejects.toMatchObject({
      status: 401,
    });
    expect(mockPrisma.studentGuardian.findUnique).not.toHaveBeenCalled();
  });

  it("throws 403 when no StudentGuardian link exists", async () => {
    mockPrisma.studentGuardian.findUnique.mockResolvedValue(null);
    await expect(
      assertGuardianOf({ agentName: "x", userId: "guardian-1" }, "student-1")
    ).rejects.toMatchObject({ status: 403 });
  });

  it("resolves when a StudentGuardian link exists", async () => {
    mockPrisma.studentGuardian.findUnique.mockResolvedValue({ id: "link-1" });
    await expect(
      assertGuardianOf({ agentName: "x", userId: "guardian-1" }, "student-1")
    ).resolves.toBeUndefined();
    expect(mockPrisma.studentGuardian.findUnique).toHaveBeenCalledWith({
      where: { studentId_guardianId: { studentId: "student-1", guardianId: "guardian-1" } },
    });
  });
});
