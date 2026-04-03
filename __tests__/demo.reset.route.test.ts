import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireUser = vi.hoisted(() => vi.fn());
const mockStudentFindMany = vi.hoisted(() => vi.fn());
const mockTransaction = vi.hoisted(() => vi.fn());
const mockDeleteMany = vi.hoisted(() => vi.fn(() => ({ mocked: true })));
const mockSeedNationalDemo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  requireUser: mockRequireUser,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    student: {
      findMany: mockStudentFindMany,
    },
    attendanceRecord: { deleteMany: mockDeleteMany },
    studentProgress: { deleteMany: mockDeleteMany },
    homeworkSubmission: { deleteMany: mockDeleteMany },
    placementTest: { deleteMany: mockDeleteMany },
    labSession: { deleteMany: mockDeleteMany },
    guardianMessage: { deleteMany: mockDeleteMany },
    sMSDeliveryLog: { deleteMany: mockDeleteMany },
    notificationLog: { deleteMany: mockDeleteMany },
    auditLog: { deleteMany: mockDeleteMany },
    scheduledWork: { deleteMany: mockDeleteMany },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/scripts/seed-demo", () => ({
  SCHOOL_DEFS: [{ id: "school-cha" }, { id: "school-mcs" }],
  seedNationalDemo: mockSeedNationalDemo,
}));

describe("POST /api/demo/reset", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.DEMO_MODE = "true";
    process.env.DEMO_RESET_SECRET = "demo-secret";
    process.env.DEMO_SCHOOL_IDS = "school-cha,school-mcs";
    mockStudentFindMany.mockResolvedValue([
      { id: "student-1", userId: "user-1" },
      { id: "student-2", userId: "user-2" },
    ]);
    mockRequireUser.mockResolvedValue({ id: "platform-admin-1", isPlatformAdmin: true });
    mockTransaction.mockResolvedValue(undefined);
    mockSeedNationalDemo.mockResolvedValue(undefined);
  });

  it("returns 403 when demo mode is disabled", async () => {
    process.env.DEMO_MODE = "false";
    const { POST } = await import("@/app/api/demo/reset/route");
    const response = await POST(new Request("http://localhost/api/demo/reset", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Not available in this environment" });
  }, 15_000);

  it("returns 401 when not authenticated", async () => {
    mockRequireUser.mockRejectedValueOnce(new Error("Unauthorized"));
    const { POST } = await import("@/app/api/demo/reset/route");
    const response = await POST(
      new Request("http://localhost/api/demo/reset", { method: "POST" })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  }, 15_000);

  it("returns 400 when demo school IDs are not configured", async () => {
    process.env.DEMO_SCHOOL_IDS = "";
    const { POST } = await import("@/app/api/demo/reset/route");
    const response = await POST(
      new Request("http://localhost/api/demo/reset", {
        method: "POST",
        headers: { "x-demo-secret": "demo-secret" },
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "DEMO_SCHOOL_IDS not configured" });
  }, 15_000);

  it("deletes demo activity data and reseeds authorized demo schools", async () => {
    const { POST } = await import("@/app/api/demo/reset/route");
    const response = await POST(
      new Request("http://localhost/api/demo/reset", {
        method: "POST",
        headers: { "x-demo-secret": "demo-secret" },
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(mockStudentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user: {
            schoolId: { in: ["school-cha", "school-mcs"] },
          },
        },
      })
    );
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockSeedNationalDemo).toHaveBeenCalledWith(
      expect.objectContaining({
        schoolIds: ["school-cha", "school-mcs"],
        allowExisting: true,
      })
    );
    expect(payload.success).toBe(true);
    expect(payload.message).toBe("Demo data reset");
    expect(typeof payload.resetAt).toBe("string");
  }, 15_000);
});
