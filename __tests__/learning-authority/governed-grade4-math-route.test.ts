import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockEventFindFirst = vi.hoisted(() => vi.fn());
const mockEventCreate = vi.hoisted(() => vi.fn());
const mockEventFindMany = vi.hoisted(() => vi.fn());
const mockEventFindUnique = vi.hoisted(() => vi.fn());
const eventStore = vi.hoisted(() => ({ rows: [] as Record<string, any>[] }));

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: mockStudentFindFirst },
    learningEvent: {
      findFirst: mockEventFindFirst,
      create: mockEventCreate,
      findMany: mockEventFindMany,
      findUnique: mockEventFindUnique,
    },
  },
}));

import { GET, POST } from "@/app/api/student/learning-authority/grade4-math/route";

describe("governed Grade 4 Math live authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mockStudentFindFirst.mockResolvedValue({ id: "student-1" });
    mockEventFindFirst.mockResolvedValue(null);
    eventStore.rows.length = 0;
    mockEventCreate.mockImplementation(async ({ data }: { data: Record<string, any> }) => {
      if (eventStore.rows.some((row) => row.id === data.id)) throw Object.assign(new Error("duplicate"), { code: "P2002" });
      eventStore.rows.push(data);
      return data;
    });
    mockEventFindMany.mockImplementation(async ({ where }: { where: { occurredAt?: { lte?: Date } } }) =>
      eventStore.rows.filter((row) => !where.occurredAt?.lte || row.occurredAt <= where.occurredAt.lte).map((row) => ({ ...row }))
    );
    mockEventFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => eventStore.rows.find((row) => row.id === where.id) ?? null);
  });

  async function issue() {
    const response = await GET();
    const data = await response.json();
    const cookie = response.headers.get("set-cookie") ?? "";
    return { response, data, cookie };
  }

  function submit(
    issued: { data: { sessionId: string; item: { id: string; version: string } }; cookie: string },
    overrides: Record<string, unknown> = {}
  ) {
    return new NextRequest("http://localhost/api/student/learning-authority/grade4-math", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: issued.cookie },
      body: JSON.stringify({
        sessionId: issued.data.sessionId,
        itemId: issued.data.item.id,
        itemVersion: issued.data.item.version,
        answerIndex: 2,
        ...overrides,
      }),
    });
  }

  it("issues one sealed initial item and server tool policy without an answer key", async () => {
    const issued = await issue();
    expect(issued.response.status).toBe(200);
    expect(issued.data).toMatchObject({
      releaseId: "lr-moe-g4-math-fractions-2026.1",
      kind: "INITIAL",
      item: { id: "g4-frac-diagnostic-equal-parts" },
    });
    expect(issued.data.item.correctIndex).toBeUndefined();
    expect(issued.data.item.misconceptionSignalByAnswerIndex).toBeUndefined();
    expect(issued.data.item.toolPolicy.prohibited).toContain("calculator");
    expect(issued.cookie).toContain("g4_math_diagnostic_session=");
    expect(issued.cookie).toContain("HttpOnly");
  });

  it("derives continuous session kind from prior server evidence", async () => {
    mockEventFindFirst.mockResolvedValue({ id: "initial-evidence" });
    const issued = await issue();
    expect(issued.data).toMatchObject({
      kind: "CONTINUOUS",
      item: { id: "g4-frac-diagnostic-compare" },
    });
  });

  it("uses legacy admission only as a one-way diagnostic-kind fallback", async () => {
    mockEventFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "legacy-initial-evidence" });
    const issued = await issue();
    expect(issued.data).toMatchObject({ kind: "CONTINUOUS", item: { id: "g4-frac-diagnostic-compare" } });
    expect(mockEventFindFirst).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ eventType: "learning.evidence_admission.recorded" }),
    }));
    expect(mockEventFindMany).not.toHaveBeenCalled();
  });

  it("server-scores and writes canonical learning state without changing administrative grade", async () => {
    const issued = await issue();
    const response = await POST(submit(issued));
    const data = await response.json();
    expect(data).toMatchObject({
      correct: true,
      admission: { decision: "ACCEPTED", bindingId: "g4-frac-bind-equal-parts-v1" },
      diagnosticSession: {
        sessionAuthority: "INSTRUCTIONAL_DIAGNOSTIC",
        kind: "INITIAL",
        schoolId: "school-1",
        studentId: "student-1",
        studentUserId: "user-1",
        mayChangeAdministrativeGrade: false,
      },
      masteryUpdated: true,
      administrativeGradeChanged: false,
      learnerState: {
        mastery: { observedScore: 1, level: "INSUFFICIENT_EVIDENCE" },
        confidence: { level: "LOW" },
        authority: { canonical: true, mayChangeAdministrativeGrade: false },
      },
    });
    expect(data.decisionModelInput).toBeUndefined();
    expect(data.learnerState.misconceptions).toBeUndefined();
    expect(data.learnerState.teacherExplanation).toBeUndefined();
    expect(data.learnerState.conflict.positiveEvidenceIds).toBeUndefined();
    expect(mockEventCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: "learning.canonical.mastery_update.v1",
        calculationVersion: "mastery-reducer/1.0.0",
      metadata: expect.objectContaining({
          canonicalEvent: expect.objectContaining({
            authority: "SERVER_GOVERNED_EVIDENCE_GATEWAY",
            admissionDecision: "ACCEPTED",
          }),
        }),
      }),
    }));
  });

  it("rejects every client attempt to assert scoring, policy context, or session authority", async () => {
    const issued = await issue();
    const response = await POST(submit(issued, {
      score: 1,
      mastery: true,
      correctAnswer: 2,
      toolsUsed: [],
      hintsUsed: 0,
      aiAssisted: false,
      sessionKind: "INITIAL",
      idempotencyKey: "forged",
      accommodationOverride: { approvedByRole: "TEACHER" },
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "client_cannot_assert_session_scoring_or_policy_context" });
    expect(mockEventCreate).not.toHaveBeenCalled();
  });

  it.each(["mastery", "confidence", "retention", "misconception", "reducerVersion", "policyVersion"])(
    "rejects a client-authored %s claim on its own",
    async (field) => {
      const issued = await issue();
      const response = await POST(submit(issued, { [field]: "forged" }));
      expect(response.status).toBe(400);
      expect(mockEventCreate).not.toHaveBeenCalled();
    }
  );

  it("rejects a forged item version or tampered session binding", async () => {
    const issued = await issue();
    const response = await POST(submit(issued, { itemVersion: "forged" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "diagnostic_session_invalid_or_expired" });
    expect(mockEventCreate).not.toHaveBeenCalled();
  });

  it("does not permit answer probing to overwrite the first sealed attempt", async () => {
    const issued = await issue();
    const first = await POST(submit(issued, { answerIndex: 0 }));
    expect((await first.json()).correct).toBe(false);
    const replay = await POST(submit(issued, { answerIndex: 2 }));
    expect(await replay.json()).toEqual({ duplicate: true, admission: "NOT_REPEATED" });
    expect(mockEventCreate).toHaveBeenCalledTimes(2);
    expect(eventStore.rows).toHaveLength(1);
  });

  it("fails closed when User and tenant cannot resolve one Student", async () => {
    mockStudentFindFirst.mockResolvedValue(null);
    const response = await POST(new NextRequest("http://localhost/api/student/learning-authority/grade4-math", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    expect(response.status).toBe(404);
    expect(mockEventFindFirst).not.toHaveBeenCalled();
  });
});
