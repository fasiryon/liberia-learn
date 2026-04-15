import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn((error: any) =>
  new Response(JSON.stringify({ error: error?.message ?? "failed" }), { status: error?.status ?? 500 })
));

const mockPrisma = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  class: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  school: {
    findUnique: vi.fn(),
  },
  academicYear: {
    findMany: vi.fn(),
  },
  enrollment: {
    upsert: vi.fn(),
  },
  academicEnrollment: {
    upsert: vi.fn(),
  },
  student: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (input: any) => {
    if (typeof input === "function") {
      return input(mockPrisma);
    }
    return Promise.all(input);
  }),
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mockRequireRole,
}));

vi.mock("@/lib/rateLimit", () => ({
  RATE_LIMIT_POLICIES: {
    INVITES: { windowMs: 1000, limit: 10 },
  },
  checkRateLimit: mockCheckRateLimit,
  rateLimitExceededResponse: vi.fn(() => new Response("too many", { status: 429 })),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/errors/apiErrorHandler", () => ({
  handleApiError: mockHandleApiError,
}));

import { POST } from "@/app/api/admin/import/route";

describe("/api/admin/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: "school-1",
    });
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
    });
  });

  it("rejects class imports that reference missing teachers", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);

    const response = await POST(
      new Request("http://localhost/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "classes",
          csv: "name,subject,teacherLoginId\nGrade 7A,MATH,TCH-404",
        }),
      }) as any
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: "Validation failed",
        rowErrors: [
          expect.objectContaining({
            row: 2,
            field: "teacherLoginId",
          }),
        ],
      })
    );
  });

  it("imports classes for the current school", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: "teacher-1", loginId: "TCH-2026-001" }]);
    mockPrisma.class.create.mockResolvedValue({ id: "class-1" });

    const response = await POST(
      new Request("http://localhost/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "classes",
          csv: "name,subject,teacherLoginId\nGrade 7A,MATH,TCH-2026-001",
        }),
      }) as any
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.class.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "school-1",
          name: "Grade 7A",
          teacherId: "teacher-1",
        }),
      })
    );
    expect(mockLogAudit).toHaveBeenCalledOnce();
  });
});
