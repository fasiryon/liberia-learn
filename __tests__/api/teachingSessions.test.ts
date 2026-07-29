import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPrisma,
  mockRequireRole,
  mockRunTeachingTurn,
  mockBuildAndSaveLedger,
} = vi.hoisted(() => {
  const prisma = {
    curriculumContent: { findFirst: vi.fn() },
    teachingSession: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    teachingTurn: { findFirst: vi.fn() },
    teachingLedger: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  return {
    mockPrisma: prisma,
    mockRequireRole: vi.fn(),
    mockRunTeachingTurn: vi.fn(),
    mockBuildAndSaveLedger: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/teaching/runtime", () => ({
  runTeachingTurn: mockRunTeachingTurn,
}));
vi.mock("@/lib/teaching/ledger", () => ({
  buildAndSaveLedger: mockBuildAndSaveLedger,
}));

import { POST } from "@/app/api/teaching/sessions/route";
import { POST as postTurn } from "@/app/api/teaching/sessions/[sessionId]/turn/route";
import { POST as postDegrade } from "@/app/api/teaching/sessions/[sessionId]/degrade/route";
import { POST as postEnd } from "@/app/api/teaching/sessions/[sessionId]/end/route";

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
  mockPrisma.teachingSession.findFirst
    .mockReset()
    .mockResolvedValue({ id: "sess-1" });
  mockPrisma.teachingSession.updateMany
    .mockReset()
    .mockResolvedValue({ count: 1 });
  mockPrisma.teachingLedger.findFirst
    .mockReset()
    .mockResolvedValue({ id: "ledger-1" });
  mockRunTeachingTurn.mockReset().mockResolvedValue({
    turnIndex: 0,
    responseText: "Fractions are parts of a whole.",
    guardrailMode: "FULL_CONFIDENCE",
    deferred: false,
    lessonDirectorAction: "continue",
    whisperSent: false,
    llmCostUSD: 0.001,
  });
  mockBuildAndSaveLedger
    .mockReset()
    .mockResolvedValue({ ledgerId: "ledger-1" });
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

describe("POST /api/teaching/sessions/[sessionId]/turn", () => {
  it("scopes a teacher to their own session within their school", async () => {
    await postTurn(
      jsonRequest({ role: "student", text: "Explain fractions." }),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(mockPrisma.teachingSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: "sess-1",
        schoolId: "school-1",
        facilitatorId: "teacher-1",
      },
      select: { id: true },
    });
  });

  it("submits a validated turn through the teaching runtime", async () => {
    const res = await postTurn(
      jsonRequest({
        role: "student",
        text: "Explain fractions.",
        correct: null,
      }),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(mockRunTeachingTurn).toHaveBeenCalledWith(
      "sess-1",
      {
        role: "student",
        text: "Explain fractions.",
        correct: null,
      },
      { userRole: "TEACHER" }
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 without invoking the runtime for an inaccessible session", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue(null);
    const res = await postTurn(
      jsonRequest({ role: "student", text: "Explain fractions." }),
      { params: Promise.resolve({ sessionId: "other-session" }) }
    );

    expect(res.status).toBe(404);
    expect(mockRunTeachingTurn).not.toHaveBeenCalled();
  });

  it("rejects an invalid or empty turn", async () => {
    const res = await postTurn(
      jsonRequest({ role: "student", text: "" }),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(res.status).toBe(400);
    expect(mockRunTeachingTurn).not.toHaveBeenCalled();
  });

  it("returns a structured 503 when the teaching agent fails closed", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue({ id: "sess-1" });
    mockRunTeachingTurn.mockRejectedValue(
      Object.assign(new Error("Teaching agent unavailable"), { status: 503 })
    );

    const response = await postTurn(
      jsonRequest({ role: "student", text: "Please explain again." }),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Teaching runtime temporarily unavailable",
    });
  });
});

describe("POST /api/teaching/sessions/[sessionId]/degrade", () => {
  it("atomically records a teacher-scoped degraded mode and audit event", async () => {
    const res = await postDegrade(
      jsonRequest({ reason: "projector" }),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(mockPrisma.teachingSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: "sess-1",
        schoolId: "school-1",
        facilitatorId: "teacher-1",
      },
      data: { degradedMode: "AUDIO_ONLY" },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "teaching.session.degrade",
        resourceId: "sess-1",
        schoolId: "school-1",
        details: {
          reason: "projector",
          mode: "AUDIO_ONLY",
        },
      }),
    });
    await expect(res.json()).resolves.toEqual({
      mode: "AUDIO_ONLY",
      recorded: true,
    });
  });

  it("records WORKSHEET for internet or power recovery", async () => {
    const res = await postDegrade(
      jsonRequest({ reason: "internet" }),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );
    await expect(res.json()).resolves.toEqual({
      mode: "WORKSHEET",
      recorded: true,
    });
  });

  it("returns 404 and writes no audit event for an inaccessible session", async () => {
    mockPrisma.teachingSession.updateMany.mockResolvedValue({ count: 0 });
    const res = await postDegrade(
      jsonRequest({ reason: "power" }),
      { params: Promise.resolve({ sessionId: "other-session" }) }
    );

    expect(res.status).toBe(404);
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown recovery reason", async () => {
    const res = await postDegrade(
      jsonRequest({ reason: "unknown" }),
      { params: Promise.resolve({ sessionId: "sess-1" }) }
    );

    expect(res.status).toBe(400);
    expect(mockPrisma.teachingSession.updateMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/teaching/sessions/[sessionId]/end", () => {
  it("blocks new turns, builds the ledger, then atomically completes and audits", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue({
      id: "sess-1",
      status: "ACTIVE",
    });

    const res = await postEnd(jsonRequest({}), {
      params: Promise.resolve({ sessionId: "sess-1" }),
    });

    expect(mockPrisma.teachingSession.updateMany.mock.calls[0][0]).toEqual({
      where: {
        id: "sess-1",
        schoolId: "school-1",
        facilitatorId: "teacher-1",
        status: "ACTIVE",
      },
      data: {
        status: "ENDING",
        endedAt: expect.any(Date),
      },
    });
    expect(mockBuildAndSaveLedger).toHaveBeenCalledWith("sess-1");
    expect(mockPrisma.teachingSession.updateMany.mock.calls[1][0]).toEqual({
      where: {
        id: "sess-1",
        schoolId: "school-1",
        facilitatorId: "teacher-1",
        status: "ENDING",
      },
      data: { status: "COMPLETED" },
    });
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "teaching.session.end",
        resourceId: "sess-1",
        schoolId: "school-1",
        details: { ledgerId: "ledger-1" },
      }),
    });
    await expect(res.json()).resolves.toEqual({
      ledgerId: "ledger-1",
      status: "COMPLETED",
    });
  });

  it("returns an existing scoped ledger when completion is retried", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue({
      id: "sess-1",
      status: "COMPLETED",
    });

    const res = await postEnd(jsonRequest({}), {
      params: Promise.resolve({ sessionId: "sess-1" }),
    });

    expect(mockPrisma.teachingLedger.findFirst).toHaveBeenCalledWith({
      where: { sessionId: "sess-1", schoolId: "school-1" },
      select: { id: true },
    });
    expect(mockBuildAndSaveLedger).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({
      ledgerId: "ledger-1",
      status: "COMPLETED",
    });
  });

  it("returns 404 without a ledger write for an inaccessible session", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue(null);
    const res = await postEnd(jsonRequest({}), {
      params: Promise.resolve({ sessionId: "other-session" }),
    });

    expect(res.status).toBe(404);
    expect(mockBuildAndSaveLedger).not.toHaveBeenCalled();
  });

  it("does not mark the session completed when ledger persistence fails", async () => {
    mockPrisma.teachingSession.findFirst.mockResolvedValue({
      id: "sess-1",
      status: "ACTIVE",
    });
    mockBuildAndSaveLedger.mockRejectedValue(new Error("ledger write failed"));

    await expect(
      postEnd(jsonRequest({}), {
        params: Promise.resolve({ sessionId: "sess-1" }),
      })
    ).rejects.toThrow("ledger write failed");

    expect(mockPrisma.teachingSession.updateMany).toHaveBeenCalledOnce();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
