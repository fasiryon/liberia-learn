import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";

const role = vi.hoisted(() => vi.fn());
const student = vi.hoisted(() => vi.fn());
const decide = vi.hoisted(() => vi.fn());
const append = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireRole: role }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findFirst: student } } }));
vi.mock("@/lib/learning-authority/learningDecisionStore", () => ({ decideLearningAction: decide }));
vi.mock("@/lib/learning-state/masteryWriter", () => ({ appendCanonicalMasteryUpdate: append }));

import { GET, POST } from "@/app/api/student/learning-authority/next-action/route";

const release = GRADE4_MATH_ONTOLOGY_RELEASE;
const decision = (itemId: string, id: string) => ({ decision: { id, learnerStateRevision: id,
  action: { itemId, kind: release.items.find((item) => item.id === itemId)!.context,
    conceptId: release.bindings.find((binding) => binding.itemId === itemId)!.conceptId, reason: "Governed action" } } });

describe("learner experience governed loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    role.mockResolvedValue({ id: "user-1", schoolId: "school-1", role: "STUDENT" });
    student.mockResolvedValue({ id: "student-1", currentGrade: 4 });
    decide.mockResolvedValue(decision("g4-frac-diagnostic-equal-parts", "decision-initial"));
    append.mockResolvedValue({ duplicate: false, update: { state: {
      modelVersion: "student-learning-model/1.0.0", reducerVersion: "mastery-reducer/1.0.0", asOf: new Date().toISOString(),
      mastery: { level: "INSUFFICIENT_EVIDENCE", observedScore: 1 }, confidence: { level: "LOW" },
      retention: { status: "FRESH" }, recency: {}, conflict: { present: false, score: 0 },
      authority: { canonical: true, mayChangeAdministrativeGrade: false, learnerMayWrite: false },
    } } });
  });

  async function issue() {
    const response = await GET();
    return { response, body: await response.json(), cookie: response.headers.get("set-cookie") ?? "" };
  }

  function answer(issued: Awaited<ReturnType<typeof issue>>, extra: Record<string, unknown> = {}) {
    return new NextRequest("http://localhost/api/student/learning-authority/next-action", { method: "POST",
      headers: { "Content-Type": "application/json", cookie: issued.cookie },
      body: JSON.stringify({ decisionId: issued.body.decisionId, sessionId: issued.body.sessionId,
        itemId: issued.body.item.id, itemVersion: issued.body.item.version, answerIndex: 2, ...extra }) });
  }

  it("releases a persisted decision, writes admitted evidence, then exposes the new practice action", async () => {
    const first = await issue();
    expect(first.body.item.id).toBe("g4-frac-diagnostic-equal-parts");
    expect(first.body.item.correctIndex).toBeUndefined();
    expect(first.body.item.hint).toBeUndefined();
    expect(first.body.item.workedExample).toBeUndefined();
    expect(first.body.toolPolicy.allowed).toEqual([]);
    expect(first.cookie).toContain("HttpOnly");
    const submitted = await POST(answer(first));
    expect(submitted.status).toBe(200);
    expect((await submitted.json()).correct).toBe(true);
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "decision-initial",
      itemId: "g4-frac-diagnostic-equal-parts", selectedAnswerIndex: 2 }));
    decide.mockResolvedValue(decision("g4-frac-practice-equivalence", "decision-practice"));
    const next = await issue();
    expect(next.body.action.kind).toBe("PRACTICE");
    expect(next.body.toolPolicy.allowed).toContain("fraction_strips");
  });

  it("rejects client mastery claims and stale or forged decision identities", async () => {
    const issued = await issue();
    expect((await POST(answer(issued, { mastery: 1 }))).status).toBe(400);
    expect((await POST(answer(issued, { decisionId: "forged" }))).status).toBe(400);
    decide.mockResolvedValue(decision("g4-frac-practice-equivalence", "decision-practice"));
    expect((await POST(answer(issued))).status).toBe(409);
    expect(append).not.toHaveBeenCalled();
  });

  it("never scores a replayed attempt, so duplicates cannot probe the answer key", async () => {
    const issued = await issue();
    append.mockResolvedValueOnce({ duplicate: true, update: { state: {} } });
    const replay = await POST(answer(issued, { answerIndex: 0 }));
    expect(replay.status).toBe(409);
    const body = await replay.json();
    expect(body.correct).toBeUndefined();
    expect(body.learnerState).toBeUndefined();
  });

  it("rejects tampered sessions, another learner's session, and out-of-range answers", async () => {
    const issued = await issue();
    const tampered = { ...issued, cookie: issued.cookie.replace(/governed_learning_action=([^;]+)/, (_m, v) => `governed_learning_action=${v.slice(0, -4)}AAAA`) };
    expect((await POST(answer(tampered))).status).toBe(400);
    expect((await POST(answer(issued, { itemVersion: "9.9.9" }))).status).toBe(400);
    expect((await POST(answer(issued, { answerIndex: 99 }))).status).toBe(400);
    role.mockResolvedValue({ id: "user-2", schoolId: "school-1", role: "STUDENT" });
    student.mockResolvedValue({ id: "student-2", currentGrade: 4 });
    expect((await POST(answer(issued))).status).toBe(400);
    expect(append).not.toHaveBeenCalled();
  });

  it("records only tools the issued ToolPolicy permits", async () => {
    const diagnostic = await issue();
    expect((await POST(answer(diagnostic, { toolsUsed: ["fraction_strips"] }))).status).toBe(400);
    decide.mockResolvedValue(decision("g4-frac-practice-equivalence", "decision-practice"));
    const practice = await issue();
    expect((await POST(answer(practice, { toolsUsed: ["calculator"] }))).status).toBe(400);
    expect((await POST(answer(practice, { toolsUsed: [1] }))).status).toBe(400);
    expect(append).not.toHaveBeenCalled();
    const ok = await POST(answer(practice, { answerIndex: 1, toolsUsed: ["fraction_strips", "fraction_strips"] }));
    expect(ok.status).toBe(200);
    expect(append).toHaveBeenCalledWith(expect.objectContaining({
      admission: expect.objectContaining({ decision: "ACCEPTED" }),
    }));
  });

  it("preserves authentication failures and offers no unsupported release", async () => {
    role.mockRejectedValueOnce(Object.assign(new Error("unauthorized"), { status: 401 }));
    expect((await GET()).status).toBe(401);
    student.mockResolvedValue({ id: "student-1", currentGrade: 7 });
    expect(await (await GET()).json()).toEqual({ available: false });
    expect(decide).not.toHaveBeenCalled();
  });
});
