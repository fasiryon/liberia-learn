/**
 * Regression tests for the PR #193 final merge-readiness review (2026-10-16).
 *
 *   A1  a single human mark on high-stakes work is not a final score: the form total stays
 *       PENDING_MODERATION until a second mark agrees or an examiner reconciles
 *   A2  the second mark and the reconciliation use the first mark's moderation policy, so the
 *       agreement tolerance cannot be swapped mid-moderation
 *   A3  admitted evidence counts as verified when objective evidence is summarized (once per response)
 *   A4  after an attempt is submitted, only an offline queue can still deliver earlier responses
 *   A5  the legacy exam submit claims the attempt atomically, so a concurrent second submit cannot
 *       re-grade it or issue a certificate
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  studentFindUnique: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptUpdateMany: vi.fn(),
  attemptUpdate: vi.fn(),
  certificationUpsert: vi.fn(),
  logAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole, requireUser: vi.fn() }));
vi.mock("@/lib/serverFlags", () => ({ isExamSystemEnabled: () => true }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.logAudit }));
vi.mock("@/lib/intelligence/recordPerformanceEvent", () => ({ recordPerformanceEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/db", () => {
  const tx = {
    examAttempt: { updateMany: mocks.attemptUpdateMany, update: mocks.attemptUpdate },
    examCertification: { upsert: mocks.certificationUpsert },
  };
  return {
    prisma: {
      student: { findUnique: mocks.studentFindUnique },
      examAttempt: { findFirst: mocks.attemptFindFirst, updateMany: mocks.attemptUpdateMany, update: mocks.attemptUpdate },
      examCertification: { upsert: mocks.certificationUpsert },
      $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { POST as submitExam } from "@/app/api/student/exams/[examId]/submit/route";
import {
  acceptClientObservation,
  admitToMastery,
  recordModeratedScore,
  recordSecondMark,
  reconcileMarks,
  scoreAttemptForm,
  scoreResponse,
  summarizeObjectiveEvidence,
  verifyObservation,
  type MasteryAdmissionPolicy,
  type ModerationPolicy,
  type ServerAttemptContext,
} from "@/lib/assessment/v2";
import { buildItems, buildReleased, CURRICULUM, SCHOOL, sealedAssistanceRecord } from "./fixtures";

const policy: ModerationPolicy = { policyId: "mod-1", version: "1", moderatorRoles: ["TEACHER", "EXAMINER"], requiresSecondMarker: false, reconciliationTolerancePercent: 10, examinerRoles: ["EXAMINER"] };
const teacherA = { kind: "HUMAN" as const, id: "t-a", role: "TEACHER", schoolId: SCHOOL };
const teacherB = { kind: "HUMAN" as const, id: "t-b", role: "TEACHER", schoolId: SCHOOL };
const examiner = { kind: "HUMAN" as const, id: "ex-1", role: "EXAMINER", schoolId: SCHOOL };
const full = [{ criterionId: "decision", points: 1 }, { criterionId: "reason", points: 1 }];
const half = [{ criterionId: "decision", points: 1 }, { criterionId: "reason", points: 0 }];

function firstMark(purpose: "SUMMATIVE" | "FORMATIVE") {
  const { worked, rubricSpec } = buildItems();
  const pending = scoreResponse(worked, rubricSpec, { kind: "TEXT", text: "No; 0.70 > 0.65 because 7 tenths > 6 tenths." });
  const first = recordModeratedScore({ pending, item: worked, spec: rubricSpec, moderator: teacherA, attemptSchoolId: SCHOOL, purpose, policy, criterionScores: full, aiSuggestion: null, moderatedAt: "2026-11-02T00:00:00.000Z" });
  return { worked, rubricSpec, first };
}

describe("A1 a single high-stakes human mark is not a final score", () => {
  it("keeps the first mark pending until a second mark agrees", () => {
    const { worked, rubricSpec, first } = firstMark("SUMMATIVE");
    expect(first.outcome.status).toBe("PENDING_HUMAN_MODERATION");
    expect(firstMark("FORMATIVE").first.outcome.status).toBe("SCORED");

    const released = buildReleased();
    const form = { ...released.form, items: [{ itemId: worked.itemId, itemVersion: worked.version, itemHash: worked.itemHash, points: 2 }] };
    const key = `${worked.itemId}@${worked.version}`;
    expect(scoreAttemptForm({ form, outcomes: new Map([[key, first.outcome]]), submitted: true })).toMatchObject({ status: "PENDING_MODERATION", earnedPoints: null });

    const agreed = recordSecondMark(first, { item: worked, spec: rubricSpec, marker: teacherB, attemptSchoolId: SCHOOL, policy, criterionScores: full, markedAt: "2026-11-03T00:00:00.000Z" });
    if (!("outcome" in agreed)) throw new Error("expected agreement");
    expect(agreed.outcome.status).toBe("SCORED");
    expect(scoreAttemptForm({ form, outcomes: new Map([[key, agreed.outcome]]), submitted: true })).toMatchObject({ status: "SCORED", earnedPoints: 2 });
  });

  it("an examiner reconciliation produces a final score", () => {
    const { worked, rubricSpec, first } = firstMark("SUMMATIVE");
    const disagreement = recordSecondMark(first, { item: worked, spec: rubricSpec, marker: teacherB, attemptSchoolId: SCHOOL, policy, criterionScores: [{ criterionId: "decision", points: 0 }, { criterionId: "reason", points: 0 }], markedAt: "2026-11-03T00:00:00.000Z" });
    if (!("status" in disagreement)) throw new Error("expected disagreement");
    const reconciled = reconcileMarks(disagreement, { item: worked, spec: rubricSpec, examiner, attemptSchoolId: SCHOOL, policy, criterionScores: half, rationale: "Reason does not compare tenths first.", reconciledAt: "2026-11-04T00:00:00.000Z" });
    expect(reconciled.outcome).toMatchObject({ status: "SCORED", points: 1 });
  });
});

describe("A2 moderation policy cannot be swapped between marks", () => {
  it("refuses a second mark or reconciliation under a different policy version", () => {
    const { worked, rubricSpec, first } = firstMark("SUMMATIVE");
    const lenient: ModerationPolicy = { ...policy, version: "2", reconciliationTolerancePercent: 100 };
    expect(() => recordSecondMark(first, { item: worked, spec: rubricSpec, marker: teacherB, attemptSchoolId: SCHOOL, policy: lenient, criterionScores: half, markedAt: "2026-11-03T00:00:00.000Z" }))
      .toThrow("assessment_moderation_policy_mismatch");
    const disagreement = recordSecondMark(first, { item: worked, spec: rubricSpec, marker: teacherB, attemptSchoolId: SCHOOL, policy, criterionScores: [{ criterionId: "decision", points: 0 }, { criterionId: "reason", points: 0 }], markedAt: "2026-11-03T00:00:00.000Z" });
    if (!("status" in disagreement)) throw new Error("expected disagreement");
    expect(() => reconcileMarks(disagreement, { item: worked, spec: rubricSpec, examiner, attemptSchoolId: SCHOOL, policy: lenient, criterionScores: half, rationale: "Reason does not compare tenths first.", reconciledAt: "2026-11-04T00:00:00.000Z" }))
      .toThrow("assessment_moderation_policy_mismatch");
  });
});

const NONE = { hintsRevealed: 0, aiTutorUsed: false, explanationSeenBeforeResponse: false, answerRevealedBeforeResponse: false, prohibitedToolUsed: false, peerCollaboration: false };

function context(attempt: Partial<ServerAttemptContext["attempt"]> = {}): ServerAttemptContext {
  const released = buildReleased();
  const { single, release, form, definition } = released;
  return {
    session: { studentId: "stu-1", studentUserId: "user-1", schoolId: SCHOOL, tenantId: "tenant-1" },
    attempt: { attemptId: "att-1", sessionId: "ses-1", studentId: "stu-1", schoolId: SCHOOL, enrollmentId: "enr-1", classId: "class-1", status: "OPEN", ...attempt },
    pins: {
      definitionId: definition.definitionId, definitionVersion: definition.version, definitionHash: definition.contentHash,
      formId: form.formId, formVersion: form.version, formHash: form.formHash,
      itemId: single.itemId, itemVersion: single.version, itemHash: single.itemHash, scoringSpecHash: single.scoringSpecHash,
      releaseId: release.releaseId, releaseHash: release.releaseHash,
      curriculumReleaseId: CURRICULUM.releaseId, curriculumReleaseIdentity: CURRICULUM.releaseIdentity,
    },
    objectiveIds: ["obj-compare"],
    delivery: { mode: "OFFICIAL", official: true, purpose: "FORMATIVE", itemContext: "REHEARSED", runtime: "WEB", accommodations: [], allowedToolIds: [] },
    receivedAt: "2026-11-01T10:00:05.000Z",
  };
}

function submission(capture: Partial<Parameters<typeof acceptClientObservation>[0]["capture"]> = {}) {
  return {
    attemptId: "att-1", itemId: "i-single", itemVersion: "1.0.0", responseSequence: 0, responseId: "r-1", responseDigest: "sha256:a", assistance: NONE,
    capture: { source: "ONLINE" as const, deviceId: null, clientEventId: "e-1", clientSequence: 0, capturedAt: "2026-11-01T10:00:00.000Z", syncBatchId: null, ...capture },
  };
}

describe("A3 admitted evidence is verified evidence when summarizing an objective", () => {
  it("counts an admitted response as verified, once", () => {
    const env = context();
    const released = buildReleased();
    const raw = acceptClientObservation(submission(), env);
    const outcome = scoreResponse(released.single, released.singleSpec, { kind: "SINGLE_SELECT", optionId: "a" });
    const { evidence: verified } = verifyObservation(raw, { outcome, release: released.release, revocations: [], moderation: null, recordedBy: { kind: "SYSTEM", id: "scorer", role: null }, recordedAt: "2026-11-01T10:00:06.000Z", assistanceLedger: sealedAssistanceRecord(raw) });
    const admission: MasteryAdmissionPolicy = { policyId: "admit", version: "1", admissiblePurposes: ["FORMATIVE"], requireOfficialDelivery: true, objectiveIds: ["obj-compare"] };
    const { evidence: admitted } = admitToMastery(verified, { policy: admission, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(verified) });
    expect(summarizeObjectiveEvidence([admitted], "obj-compare", [])).toMatchObject({ status: "VERIFIED", verifiedCount: 1, pointsEarned: 1, pointsPossible: 1 });
    expect(summarizeObjectiveEvidence([raw, verified, admitted], "obj-compare", [])).toMatchObject({ status: "VERIFIED", verifiedCount: 1, independentCount: 1, pointsEarned: 1 });
  });
});

describe("A4 responses after submission", () => {
  it("accepts only offline-queued responses captured before submission", () => {
    const submitted = context({ status: "SUBMITTED", submittedAt: "2026-11-01T10:00:03.000Z" });
    expect(() => acceptClientObservation(submission({ capturedAt: "2026-11-01T10:00:01.000Z" }), submitted)).toThrow("assessment_attempt_already_submitted");
    const offline = acceptClientObservation(submission({ source: "OFFLINE", deviceId: "dev-1", syncBatchId: "b-1", capturedAt: "2026-11-01T10:00:01.000Z" }), submitted);
    expect(offline.tier).toBe("RAW_OBSERVATION");
  });
});

describe("A5 legacy exam submit is claimed atomically", () => {
  const attempt = {
    id: "attempt-1", examId: "exam-1", studentId: "student-1", startedAt: new Date(Date.now() - 10 * 60_000), submittedAt: null,
    exam: { id: "exam-1", subject: "MATH", grade: 7, passingScore: 0.7, timeLimit: 30, resultsPublishedAt: null, academicYearId: null,
      questions: [{ id: "q1", correctIndex: 0, moeCode: "M1", points: 1, options: ["a", "b"] }] },
  };
  const request = () => new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ attemptId: "attempt-1", answers: [0], questionIds: ["q1"] }) });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "user-1", role: "STUDENT", schoolId: "school-1" });
    mocks.studentFindUnique.mockResolvedValue({ id: "student-1" });
    mocks.attemptFindFirst.mockImplementation(({ where }: { where: { passed?: boolean } }) => Promise.resolve(where.passed ? null : attempt));
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("writes the result only if the attempt is still unsubmitted", async () => {
    mocks.attemptUpdateMany.mockResolvedValue({ count: 1 });
    const response = await submitExam(request() as never, { params: { examId: "exam-1" } });
    expect(response.status).toBe(200);
    expect(mocks.attemptUpdateMany.mock.calls[0][0].where).toEqual({ id: "attempt-1", submittedAt: null });
    expect(mocks.attemptUpdate).not.toHaveBeenCalled();
  });

  it("refuses a concurrent second submit without re-grading or certifying", async () => {
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 });
    const response = await submitExam(request() as never, { params: { examId: "exam-1" } });
    expect(response.status).toBe(409);
    expect(mocks.certificationUpsert).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });
});
