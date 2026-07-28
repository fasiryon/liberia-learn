import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireRole } = vi.hoisted(() => {
  const prisma = {
    curriculumContent: { findFirst: vi.fn() },
    teachingSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    teachingTurn: { findFirst: vi.fn() },
    teachingLedger: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    mockPrisma: prisma,
    mockRequireRole: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));

import { POST } from "@/app/api/teaching/sessions/route";

const TEACHER = {
  id: "teacher-1",
  role: "TEACHER",
  schoolId: "school-1",
};
const CONTENT = {
  id: "internal-content-1",
  contentId: "content-1",
  grade: 7,
  subject: "MATHEMATICS",
  status: "APPROVED",
  schoolId: null,
  moeAlignments: {
    contentId: "internal-content-1",
    standards: [
      {
        code: "MOE-MATH-G7-01",
        description: "Understand fractions.",
        confidence: "high",
      },
    ],
    alignedAt: "2026-07-28T10:00:00.000Z",
    method: "exact",
  },
  payload: {
    body: "Fractions are parts of a whole.",
    objectives: ["Understand fractions"],
  },
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/teaching/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockRequireRole.mockReset().mockResolvedValue(TEACHER);
  mockPrisma.curriculumContent.findFirst.mockReset().mockResolvedValue(CONTENT);
  mockPrisma.teachingSession.create
    .mockReset()
    .mockImplementation(({ data }) =>
      Promise.resolve({ id: "sess-1", ...data })
    );
  mockPrisma.auditLog.create
    .mockReset()
    .mockResolvedValue({ id: "audit-1" });
  mockPrisma.$transaction
    .mockReset()
    .mockImplementation((callback) => callback(mockPrisma));
});

describe("POST /api/teaching/sessions", () => {
  it("requires TEACHER or ADMIN role", async () => {
    await POST(jsonRequest({ contentId: "content-1" }));
    expect(mockRequireRole).toHaveBeenCalledWith("TEACHER", "ADMIN");
  });

  it("scopes the live lesson lookup to approved national or same-school content", async () => {
    await POST(jsonRequest({ contentId: "content-1" }));
    expect(mockPrisma.curriculumContent.findFirst).toHaveBeenCalledWith({
      where: {
        contentId: "content-1",
        status: { in: ["APPROVED", "approved", "published"] },
        OR: [{ schoolId: null }, { schoolId: "school-1" }],
      },
    });
  });

  it("derives tenant, grade, and subject instead of trusting request fields", async () => {
    await POST(
      jsonRequest({
        contentId: "content-1",
        schoolId: "school-other",
        grade: "12",
        subject: "SCIENCE",
      })
    );

    expect(mockPrisma.teachingSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: "school-1",
        grade: "7",
        subject: "MATHEMATICS",
      }),
    });
  });

  it("determines alignment mode from the live lesson, not a cached count", async () => {
    const res = await POST(jsonRequest({ contentId: "content-1" }));
    const body = await res.json();
    expect(body.alignmentMode).toBe("FULL_CONFIDENCE");
  });

  it("creates the session and AuditLog atomically before returning", async () => {
    await POST(jsonRequest({ contentId: "content-1" }));
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "teacher-1",
        action: "teaching.session.start",
        resourceType: "TeachingSession",
        schoolId: "school-1",
      }),
    });
  });

  it("returns 404 when no visible approved lesson exists", async () => {
    mockPrisma.curriculumContent.findFirst.mockResolvedValue(null);
    const res = await POST(jsonRequest({ contentId: "missing" }));
    expect(res.status).toBe(404);
  });

  it("returns the session id, alignment mode, narration, and slides", async () => {
    const res = await POST(jsonRequest({ contentId: "content-1" }));
    const body = await res.json();
    expect(body.sessionId).toBe("sess-1");
    expect(body.narration).toBe("Fractions are parts of a whole.");
    expect(Array.isArray(body.slides)).toBe(true);
  });

  it("rejects accounts without a school tenant", async () => {
    mockRequireRole.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      schoolId: null,
      isPlatformAdmin: true,
    });
    const res = await POST(jsonRequest({ contentId: "content-1" }));
    expect(res.status).toBe(403);
    expect(mockPrisma.teachingSession.create).not.toHaveBeenCalled();
  });
});
