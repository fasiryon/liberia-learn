import { beforeEach, describe, expect, it, vi } from "vitest";
import { deterministicReleaseIdentity, GRADE4_MATH_ONTOLOGY_RELEASE } from "@/lib/learning-authority/governedGrade4Math";
import { replayStudentConceptState } from "@/lib/learning-state/studentLearningModel";

const db = vi.hoisted(() => ({
  rows: [] as Record<string, any>[],
  count: 0,
  member: true,
}));
vi.mock("@/lib/db", () => {
  const learningEvent = {
    findFirst: vi.fn(async () => db.rows.filter((row) => row.eventType === "learning.policy_resolution.v1" &&
      ["TEACHER", "ADMIN"].includes(row.actorRole)).at(-1) ?? null),
    findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      db.rows.filter((row) => where.id.in.includes(row.id))),
    count: vi.fn(async () => db.count),
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => { db.rows.push(data); return data; }),
  };
  return { prisma: {
    student: { findFirst: vi.fn(async () => db.member ? { id: "student-a" } : null) },
    learningEvent,
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({ learningEvent })),
  } };
});
vi.mock("@/lib/learning-state/masteryWriter", () => ({
  readCanonicalStudentConceptState: vi.fn(async ({ scope, asOf }: { scope: any; asOf: string }) =>
    replayStudentConceptState([], { expectedScope: scope, asOf })),
}));

import { decideGrade4LearningAction } from "@/lib/learning-authority/learningDecisionStore";

const input = { schoolId: "school-a", studentId: "student-a", studentUserId: "user-a", idempotencyKey: "stable-request" };

describe("learning decision event persistence", () => {
  beforeEach(() => { db.rows.length = 0; db.count = 0; db.member = true; });

  it("persists three linked, tenant-bound facts and replays the same decision idempotently", async () => {
    const first = await decideGrade4LearningAction(input);
    expect(first.duplicate).toBe(false);
    expect(db.rows.map((row) => row.eventType)).toEqual([
      "learning.recommendation.v1", "learning.policy_resolution.v1", "learning.decision.v1",
    ]);
    expect(db.rows.every((row) => row.schoolId === input.schoolId && row.studentId === input.studentId)).toBe(true);
    expect(first.decision.ontologyReleaseIdentity).toBe(deterministicReleaseIdentity(GRADE4_MATH_ONTOLOGY_RELEASE));
    const replay = await decideGrade4LearningAction(input);
    expect(replay.duplicate).toBe(true);
    expect(replay.decision.id).toBe(first.decision.id);
    expect(db.rows).toHaveLength(3);
  });

  it("fails closed on new canonical events before persistence", async () => {
    db.count = 1;
    await expect(decideGrade4LearningAction(input)).rejects.toThrow("learner_state_stale");
    expect(db.rows).toHaveLength(0);
  });

  it("rejects cross-tenant or missing student membership", async () => {
    db.member = false;
    await expect(decideGrade4LearningAction(input)).rejects.toThrow("grade4_student_membership_invalid");
    expect(db.rows).toHaveLength(0);
  });

  it("makes an authorized teacher override visible as the learner's effective decision", async () => {
    const teacher = await decideGrade4LearningAction({ ...input, idempotencyKey: "teacher-override",
      teacherOverride: { candidateId: "g4-frac-bind-equal-parts-v1:diagnostic", actorId: "teacher-a",
        role: "TEACHER", reason: "Observed need for a diagnostic" } });
    const learner = await decideGrade4LearningAction({ ...input, idempotencyKey: "student-next-action-v1" });
    expect(learner.decision.id).toBe(teacher.decision.id);
    expect(learner.resolution.teacherOverride?.actorId).toBe("teacher-a");
    expect(db.rows).toHaveLength(3);
  });

  it("does not replay a teacher override after canonical state advances", async () => {
    await decideGrade4LearningAction({ ...input, idempotencyKey: "teacher-override",
      teacherOverride: { candidateId: "g4-frac-bind-equal-parts-v1:diagnostic", actorId: "teacher-a",
        role: "TEACHER", reason: "Observed need" } });
    db.count = 1;
    await expect(decideGrade4LearningAction({ ...input, idempotencyKey: "student-next-action-v1" }))
      .rejects.toThrow("learner_state_stale");
  });
});
