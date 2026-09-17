import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockAppendReview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
vi.mock("@/lib/db", () => ({ prisma: { student: { findFirst: mockStudentFindFirst } } }));
vi.mock("@/lib/learning-state/masteryWriter", () => ({ appendGovernedMisconceptionReview: mockAppendReview }));
vi.mock("@/lib/learning-state/studentLearningModel", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/learning-state/studentLearningModel")>();
  return { ...original, toDecisionModelLearnerState: vi.fn(() => ({ contractVersion: "decision-model-learner-state/1.0.0" })) };
});

import { POST } from "@/app/api/teacher/learning-authority/grade4-math/misconceptions/route";

function request(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/teacher/learning-authority/grade4-math/misconceptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: "student-a",
      conceptId: "g4-fractions-equal-parts",
      signalId: "g4-fractions-numerator-denominator-reversal",
      decision: "CONFIRMED",
      evidenceIds: ["evidence-a"],
      ...overrides,
    }),
  });
}

describe("governed misconception review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({ id: "teacher-a", role: "TEACHER", schoolId: "school-a" });
    mockStudentFindFirst.mockResolvedValue({ id: "student-a", userId: "student-user-a" });
    mockAppendReview.mockResolvedValue({
      duplicate: false,
      update: { state: { authority: { canonical: true, mayChangeAdministrativeGrade: false } } },
    });
  });

  it("derives tenant, learner User, release, actor, and policy authority on the server", async () => {
    const response = await POST(request({
      schoolId: "forged-school",
      studentUserId: "forged-user",
      actorUserId: "forged-actor",
      policyVersion: "forged-policy",
    }));
    expect(response.status).toBe(200);
    expect(mockAppendReview).toHaveBeenCalledWith(expect.objectContaining({
      scope: expect.objectContaining({ schoolId: "school-a", studentId: "student-a", studentUserId: "student-user-a" }),
      actorUserId: "teacher-a",
      signalId: "g4-fractions-numerator-denominator-reversal",
    }));
  });

  it("fails closed when the learner is outside the actor's school", async () => {
    mockStudentFindFirst.mockResolvedValue(null);
    const response = await POST(request());
    expect(response.status).toBe(404);
    expect(mockAppendReview).not.toHaveBeenCalled();
  });

  it("rejects arbitrary signals and empty evidence references", async () => {
    expect((await POST(request({ signalId: "llm-suggestion" }))).status).toBe(400);
    expect((await POST(request({ evidenceIds: [] }))).status).toBe(400);
    expect(mockAppendReview).not.toHaveBeenCalled();
  });
});
