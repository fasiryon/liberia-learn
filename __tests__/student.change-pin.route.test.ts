import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockHash = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findFirst: mockStudentFindFirst,
    },
    user: {
      update: mockUserUpdate,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: mockHash,
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

describe("POST /api/student/change-pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockHash.mockResolvedValue("hashed-pin");
    mockUserUpdate.mockResolvedValue({ id: "user-1" });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns the placement path when the student has not completed placement", async () => {
    vi.resetModules();
    mockStudentFindFirst.mockResolvedValue({ id: "student-1", placementTests: [] });
    const { POST } = await import("@/app/api/student/change-pin/route");

    const response = await POST(
      new Request("http://localhost/api/student/change-pin", {
        method: "POST",
        body: JSON.stringify({ pin: "1234", confirmPin: "1234" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, nextPath: "/student/placement" });
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mustChangePIN: false, hashedPwd: "hashed-pin" }),
      })
    );
  });

  it("returns the dashboard path when placement already exists", async () => {
    mockStudentFindFirst.mockResolvedValue({ id: "student-1", placementTests: [{ id: "placement-1" }] });
    const { POST } = await import("@/app/api/student/change-pin/route");

    const response = await POST(
      new Request("http://localhost/api/student/change-pin", {
        method: "POST",
        body: JSON.stringify({ pin: "4567", confirmPin: "4567" }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, nextPath: "/dashboard" });
    expect(mockLogAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "student.pin.changed" }));
  });
});
