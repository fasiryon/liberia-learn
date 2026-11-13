import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireRole = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const mockAppendReview = vi.hoisted(() => vi.fn());
const mockReadState = vi.hoisted(() => vi.fn());
const mockClassFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));
// AT-GRADE-01 batch 3 (CoS ruling 8): the route reaches the learner through lib/authz/classAuthority, which reads the
// class and the teacher's assignments; the retired listAuthorizedClassIdsForTeacher helper is no longer used.
vi.mock("@/lib/db", () => ({ prisma: {
  student: { findFirst: mockStudentFindFirst },
  class: { findUnique: mockClassFindUnique },
  teacherAssignment: { findMany: async () => [] },
} }));
vi.mock("@/lib/learning-state/masteryWriter", () => ({
  appendGovernedMisconceptionReview: mockAppendReview,
  readCanonicalStudentConceptState: mockReadState,
}));
vi.mock("@/lib/learning-state/studentLearningModel", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/learning-state/studentLearningModel")>();
  return { ...original, toDecisionModelLearnerState: vi.fn(() => ({ contractVersion: "decision-model-learner-state/1.0.0" })) };
});

import { GET, POST } from "@/app/api/teacher/learning-authority/grade4-math/misconceptions/route";

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
    // The learner is enrolled in owned-class, which teacher-a teaches.
    mockStudentFindFirst.mockResolvedValue({ id: "student-a", userId: "student-user-a", enrollments: [{ classId: "owned-class", Class: { schoolId: "school-a" } }] });
    mockClassFindUnique.mockResolvedValue({ schoolId: "school-a", teacherId: "teacher-a" });
    mockAppendReview.mockResolvedValue({
      duplicate: false,
      update: { state: { authority: { canonical: true, mayChangeAdministrativeGrade: false } } },
    });
    mockReadState.mockImplementation(async ({ scope }: { scope: { conceptId: string } }) => ({
      scope,
      misconceptions: scope.conceptId === "g4-fractions-equal-parts" ? [{
        signalId: "g4-fractions-numerator-denominator-reversal",
        status: "SUSPECTED",
        signalEvidenceIds: ["evidence-a"],
        confirmingReviewIds: [],
        rejectingReviewIds: [],
      }] : [],
      teacherExplanation: ["Evidence covers one released item."],
    }));
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

  it("lets an authorized assigned teacher discover suspected signals and canonical evidence IDs", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/teacher/learning-authority/grade4-math/misconceptions?studentId=student-a"
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      studentId: "student-a",
      suspectedSignals: [{
        conceptId: "g4-fractions-equal-parts",
        signalId: "g4-fractions-numerator-denominator-reversal",
        status: "SUSPECTED",
        evidenceIds: ["evidence-a"],
      }],
      administrativeGradeMayChange: false,
    });
    expect(mockReadState).toHaveBeenCalledTimes(3);
    // The learner is looked up in the actor's school, and the class basis is decided by the class-authority service on
    // the learner's own class (a timetable entry is no longer a basis; CoS ruling A).
    expect(mockStudentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "student-a", user: { schoolId: "school-a" } }),
    }));
    expect(mockClassFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "owned-class" } }));
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

  it("returns a client error for evidence references outside canonical replay", async () => {
    mockAppendReview.mockRejectedValueOnce(new Error("misconception_review_evidence_invalid"));
    const response = await POST(request({ evidenceIds: ["wrong-concept-evidence"] }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_evidence_references" });
  });
});
