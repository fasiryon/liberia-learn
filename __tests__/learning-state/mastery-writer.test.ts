import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());
const mockFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindFirst = vi.hoisted(() => vi.fn());
const mockStudentFindFirst = vi.hoisted(() => vi.fn());
const store = vi.hoisted(() => ({ rows: [] as Record<string, any>[] }));

vi.mock("@/lib/db", () => ({
  prisma: {
    learningEvent: { create: mockCreate, findMany: mockFindMany, findUnique: mockFindUnique },
    user: { findFirst: mockUserFindFirst },
    student: { findFirst: mockStudentFindFirst },
  },
}));

import {
  appendCanonicalMasteryUpdate,
  appendGovernedMisconceptionReview,
  createGovernedMasteryEvidence,
} from "@/lib/learning-state/masteryWriter";

const admission = {
  decision: "ACCEPTED" as const,
  reason: "governed_evidence_admitted",
  bindingId: "g4-frac-bind-equal-parts-v1",
  policyVersion: "1.0.0",
  toolPolicyVersion: "1.0.0",
  legacyMasteryProjectionAllowed: false as const,
};

const input = {
  schoolId: "school-a",
  studentId: "student-a",
  studentUserId: "user-a",
  sessionId: "sealed-session-a",
  itemId: "g4-frac-diagnostic-equal-parts",
  itemVersion: "1.0.0",
  selectedAnswerIndex: 3,
  occurredAt: "2026-01-01T00:00:00.000Z",
  admission,
};

describe("canonical mastery writer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.rows.length = 0;
    mockCreate.mockImplementation(async ({ data }: { data: Record<string, any> }) => {
      store.rows.push(data);
      return data;
    });
    mockFindMany.mockImplementation(async ({ where }: { where: { occurredAt?: { lte?: Date } } }) =>
      store.rows.filter((row) => !where.occurredAt?.lte || row.occurredAt <= where.occurredAt.lte).map((row) => ({ ...row }))
    );
    mockFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => store.rows.find((row) => row.id === where.id) ?? null);
    mockUserFindFirst.mockResolvedValue({ id: "teacher-a", role: "TEACHER" });
    mockStudentFindFirst.mockResolvedValue({ id: "student-a" });
  });

  it("derives correctness, strength inputs, and exact misconception signal from the governed release", () => {
    expect(createGovernedMasteryEvidence(input)).toMatchObject({
      result: "INCORRECT",
      selectedAnswerIndex: 3,
      bindingId: "g4-frac-bind-equal-parts-v1",
      authority: "SERVER_GOVERNED_EVIDENCE_GATEWAY",
      misconceptionSignalId: "g4-fractions-numerator-denominator-reversal",
    });
  });

  it("rejects provisional evidence and forged binding/version/answer data", () => {
    expect(() => createGovernedMasteryEvidence({ ...input, admission: { ...admission, decision: "PROVISIONAL" as never } }))
      .toThrow("canonical_mastery_requires_accepted_evidence");
    expect(() => createGovernedMasteryEvidence({ ...input, itemVersion: "forged" })).toThrow("canonical_mastery_binding_invalid");
    expect(() => createGovernedMasteryEvidence({ ...input, selectedAnswerIndex: 99 })).toThrow("canonical_mastery_binding_invalid");
  });

  it("fails closed when mandatory canonical persistence fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(appendCanonicalMasteryUpdate(input)).rejects.toThrow("database unavailable");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("writes the reserved event and returns replayed state", async () => {
    const result = await appendCanonicalMasteryUpdate(input);
    expect(result.duplicate).toBe(false);
    expect(result.update.state).toMatchObject({
      mastery: { observedScore: 0 },
      misconceptions: [{ signalId: "g4-fractions-numerator-denominator-reversal", status: "SUSPECTED" }],
      authority: { canonical: true, clientMayWrite: false, deviceMayWrite: false, llmMayWrite: false },
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: "learning.canonical.mastery_update.v1",
        source: "governed-learning-authority",
      }),
    }));
  });

  it("accepts a concurrent exact-attempt duplicate only after validating the stored canonical envelope", async () => {
    const first = await appendCanonicalMasteryUpdate(input);
    const row = store.rows[0];
    mockCreate.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));
    mockFindUnique.mockResolvedValueOnce(row);
    const duplicate = await appendCanonicalMasteryUpdate({ ...input, selectedAnswerIndex: 2, occurredAt: "2026-01-01T00:00:01.000Z" });
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.update.state.mastery.observedScore).toBe(0);
    expect(duplicate.update.event).toMatchObject({ result: "INCORRECT", selectedAnswerIndex: 3, occurredAt: input.occurredAt });
    expect(store.rows).toHaveLength(1);
  });

  it("fails closed when a primary-key collision is not the same canonical attempt", async () => {
    mockCreate.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));
    mockFindUnique.mockResolvedValueOnce({
      id: createGovernedMasteryEvidence(input).evidenceId,
      eventType: "offline.raw_observation",
      source: "device",
      schoolId: "school-a",
      studentId: "student-a",
      userId: "user-a",
      actorId: "device-a",
      actorRole: "DEVICE",
      calculationVersion: null,
      occurredAt: new Date(input.occurredAt),
      metadata: {},
    });
    await expect(appendCanonicalMasteryUpdate(input)).rejects.toThrow("canonical_mastery_event_id_collision");
  });

  it("rejects a writer call when Student, User, and school membership do not resolve", async () => {
    mockStudentFindFirst.mockResolvedValueOnce(null);
    await expect(appendCanonicalMasteryUpdate(input)).rejects.toThrow("canonical_mastery_student_membership_invalid");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("derives a retention probe only after a prior same-concept success and seven-day delay", async () => {
    const first = await appendCanonicalMasteryUpdate({ ...input, selectedAnswerIndex: 2 });
    expect(first.update.event).toMatchObject({ retentionProbe: false });
    const delayed = await appendCanonicalMasteryUpdate({
      ...input,
      sessionId: "sealed-session-b",
      occurredAt: "2026-01-08T00:00:00.000Z",
      selectedAnswerIndex: 0,
    });
    expect(delayed.update.event).toMatchObject({ retentionProbe: true, result: "INCORRECT" });
    expect(delayed.update.state.retention).toMatchObject({ lastProbeResult: "INCORRECT" });
  });

  it("persists confirmation only for a tenant-authorized human and referenced governed evidence", async () => {
    const mastery = await appendCanonicalMasteryUpdate(input);
    const review = await appendGovernedMisconceptionReview({
      scope: mastery.update.state.scope,
      signalId: "g4-fractions-numerator-denominator-reversal",
      decision: "CONFIRMED",
      evidenceIds: [mastery.update.event.type === "GOVERNED_EVIDENCE" ? mastery.update.event.evidenceId : ""],
      actorUserId: "teacher-a",
      occurredAt: "2026-01-02T00:00:00.000Z",
    });
    expect(review.update.state.misconceptions[0]).toMatchObject({ status: "CONFIRMED" });
    expect(store.rows[1]).toMatchObject({ actorId: "teacher-a", actorRole: "TEACHER" });
  });

  it("treats a later retry of the same review as idempotent and returns the stored timestamp", async () => {
    const mastery = await appendCanonicalMasteryUpdate(input);
    const reviewInput = {
      scope: mastery.update.state.scope,
      signalId: "g4-fractions-numerator-denominator-reversal",
      decision: "CONFIRMED" as const,
      evidenceIds: [mastery.update.event.type === "GOVERNED_EVIDENCE" ? mastery.update.event.evidenceId : ""],
      actorUserId: "teacher-a",
      occurredAt: "2026-01-02T00:00:00.000Z",
    };
    const first = await appendGovernedMisconceptionReview(reviewInput);
    const stored = store.rows[1];
    stored.metadata = {
      canonicalEvent: {
        ...stored.metadata.canonicalEvent,
        scope: {
          conceptId: stored.metadata.canonicalEvent.scope.conceptId,
          studentUserId: stored.metadata.canonicalEvent.scope.studentUserId,
          schoolId: stored.metadata.canonicalEvent.scope.schoolId,
          ontologyReleaseIdentity: stored.metadata.canonicalEvent.scope.ontologyReleaseIdentity,
          studentId: stored.metadata.canonicalEvent.scope.studentId,
          ontologyReleaseId: stored.metadata.canonicalEvent.scope.ontologyReleaseId,
        },
      },
    };
    mockCreate.mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }));
    mockFindUnique.mockResolvedValueOnce(stored);
    const duplicate = await appendGovernedMisconceptionReview({ ...reviewInput, occurredAt: "2026-01-03T00:00:00.000Z" });
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.update.event).toMatchObject({ occurredAt: "2026-01-02T00:00:00.000Z" });
  });

  it("rejects an unauthorized or cross-tenant misconception reviewer", async () => {
    const mastery = await appendCanonicalMasteryUpdate(input);
    mockUserFindFirst.mockResolvedValueOnce(null);
    await expect(appendGovernedMisconceptionReview({
      scope: mastery.update.state.scope,
      signalId: "g4-fractions-numerator-denominator-reversal",
      decision: "REJECTED",
      evidenceIds: [mastery.update.event.type === "GOVERNED_EVIDENCE" ? mastery.update.event.evidenceId : ""],
      actorUserId: "teacher-other-school",
      occurredAt: "2026-01-02T00:00:00.000Z",
    })).rejects.toThrow("misconception_review_actor_unauthorized");
  });
});
