import { describe, expect, it } from "vitest";
import { validateGovernedEvidence } from "@/lib/learning-evidence/evidenceContract";
import {
  acceptClientObservation,
  adaptG7CandidateTasks,
  admitToMastery,
  appendEvidence,
  ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED,
  assertLearnerSafe,
  blueprintGaps,
  classifyIndependence,
  classifyRetentionEvidence,
  classifyTransferEvidence,
  createProvisionalFeedback,
  effectiveStanding,
  emptyLedger,
  evidenceForStudentLearningModel,
  gradebookEligibility,
  hashEvidence,
  legacyExamQuestionToCandidate,
  orderForReplay,
  planRetentionOpportunities,
  projectItemForLearner,
  PROPOSED_RETENTION_POLICY,
  protectedStrings,
  resolveBundleAssessmentReference,
  resolveRetentionPolicy,
  revokeRelease,
  scoreResponse,
  signalsForOrchestrator,
  summarizeObjectiveEvidence,
  toGovernedLearningEvidence,
  verifyObservation,
  deriveContentStatus,
  defaultReviewPolicy,
  validateItem,
  type AssessmentEvidenceEnvelope,
  type AssistanceExposure,
  type ClientObservationSubmission,
  type MasteryAdmissionPolicy,
  type RetentionSchedulePolicy,
  type ServerAttemptContext,
} from "@/lib/assessment/v2";
import { buildItems, buildReleased, CURRICULUM, LEAD, SCHOOL, sealedAssistanceRecord } from "./fixtures";

const NONE: AssistanceExposure = { hintsRevealed: 0, aiTutorUsed: false, explanationSeenBeforeResponse: false, answerRevealedBeforeResponse: false, prohibitedToolUsed: false, peerCollaboration: false };
const admission: MasteryAdmissionPolicy = { policyId: "admit-g7-math", version: "1.0.0", admissiblePurposes: ["FORMATIVE", "SUMMATIVE", "RETENTION", "TRANSFER"], requireOfficialDelivery: true, objectiveIds: ["obj-compare"] };

function setup(overrides: { purpose?: ServerAttemptContext["delivery"]["purpose"]; official?: boolean; mode?: ServerAttemptContext["delivery"]["mode"]; released?: boolean } = {}) {
  const released = buildReleased();
  const { single, release, form, definition } = released;
  const context: ServerAttemptContext = {
    session: { studentId: "stu-1", studentUserId: "user-1", schoolId: SCHOOL, tenantId: "tenant-1" },
    attempt: { attemptId: "att-1", sessionId: "ses-1", studentId: "stu-1", schoolId: SCHOOL, enrollmentId: "enr-1", classId: "class-1", status: "OPEN" },
    pins: {
      definitionId: definition.definitionId, definitionVersion: definition.version, definitionHash: definition.contentHash,
      formId: form.formId, formVersion: form.version, formHash: form.formHash,
      itemId: single.itemId, itemVersion: single.version, itemHash: single.itemHash, scoringSpecHash: single.scoringSpecHash,
      releaseId: overrides.released === false ? null : release.releaseId, releaseHash: overrides.released === false ? null : release.releaseHash,
      curriculumReleaseId: CURRICULUM.releaseId, curriculumReleaseIdentity: CURRICULUM.releaseIdentity,
    },
    objectiveIds: ["obj-compare"],
    delivery: { mode: overrides.mode ?? "OFFICIAL", official: overrides.official ?? true, purpose: overrides.purpose ?? "FORMATIVE", itemContext: "REHEARSED", runtime: "WEB", accommodations: ["READ_ALOUD"], allowedToolIds: [] },
    receivedAt: "2026-11-01T10:00:05.000Z",
  };
  return { ...released, context };
}

function submission(overrides: Partial<ClientObservationSubmission> = {}): ClientObservationSubmission {
  return {
    attemptId: "att-1", itemId: "i-single", itemVersion: "1.0.0", responseSequence: 0, responseId: "resp-1", responseDigest: "sha256:a",
    assistance: NONE,
    capture: { source: "ONLINE", deviceId: null, clientEventId: "evt-1", clientSequence: 0, capturedAt: "2026-11-01T10:00:00.000Z", syncBatchId: null },
    ...overrides,
  };
}

function verifiedChain(env = setup(), sub = submission()) {
  const raw = acceptClientObservation(sub, env.context);
  const outcome = scoreResponse(env.single, env.singleSpec, { kind: "SINGLE_SELECT", optionId: "a" });
  const { evidence: verified } = verifyObservation(raw, { outcome, release: env.release, revocations: [], moderation: null, recordedBy: { kind: "SYSTEM", id: "scorer", role: null }, recordedAt: "2026-11-01T10:00:06.000Z", assistanceLedger: sealedAssistanceRecord(raw) });
  return { env, raw, verified };
}

describe("Client boundary: forged scores and identity substitution", () => {
  it("rejects client-asserted scores, tiers, correctness and mastery", () => {
    const { context } = setup();
    for (const field of ["score", "correct", "tier", "admission", "mastery", "official", "independence"]) {
      expect(() => acceptClientObservation({ ...submission(), [field]: field === "score" ? 1 : true } as never, context)).toThrow("assessment_client_asserted_scoring_forbidden");
    }
  });

  it("rejects student or school ID substitution and attempts owned by someone else", () => {
    const { context } = setup();
    expect(() => acceptClientObservation(submission({ studentId: "stu-2" }), context)).toThrow("assessment_scope_substitution");
    expect(() => acceptClientObservation(submission({ schoolId: "school-2" }), context)).toThrow("assessment_scope_substitution");
    expect(() => acceptClientObservation(submission(), { ...context, attempt: { ...context.attempt, studentId: "stu-2" } })).toThrow("assessment_attempt_not_owned");
    expect(() => acceptClientObservation(submission(), { ...context, attempt: { ...context.attempt, schoolId: "school-2" } })).toThrow("assessment_attempt_not_owned");
    expect(() => acceptClientObservation(submission(), { ...context, attempt: { ...context.attempt, status: "CLOSED" } })).toThrow("assessment_attempt_closed");
    expect(() => acceptClientObservation(submission({ itemVersion: "0.9.0" }), context)).toThrow("assessment_item_version_mismatch");
  });

  it("records identity from the server session, never from the payload", () => {
    const { context } = setup();
    const raw = acceptClientObservation(submission({ studentId: "stu-1" }), context);
    expect(raw.scope).toMatchObject({ studentId: "stu-1", schoolId: SCHOOL, tenantId: "tenant-1", enrollmentId: "enr-1" });
    expect(raw.tier).toBe("RAW_OBSERVATION");
    expect(raw.scoring.status).toBe("UNSCORED");
  });
});

describe("Independence and tier separation", () => {
  it("marks hints, AI tutor, seen answers/explanations, prohibited tools and peer help as assisted", () => {
    expect(classifyIndependence(NONE)).toBe("INDEPENDENT");
    for (const exposure of [{ hintsRevealed: 1 }, { aiTutorUsed: true }, { explanationSeenBeforeResponse: true }, { answerRevealedBeforeResponse: true }, { prohibitedToolUsed: true }, { peerCollaboration: true }]) {
      expect(classifyIndependence({ ...NONE, ...exposure })).toBe("ASSISTED");
    }
  });

  it("verifies assisted evidence truthfully but never admits it to mastery", () => {
    const { verified } = verifiedChain(setup(), submission({ assistance: { ...NONE, aiTutorUsed: true } }));
    expect(verified.independence).toBe("ASSISTED");
    expect(() => admitToMastery(verified, { policy: admission, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(verified) })).toThrow("assessment_assisted_evidence_not_admissible");
  });

  it("cannot verify unreleased (reviewer preview) or revoked-release evidence", () => {
    const preview = setup({ released: false, mode: "REVIEWER_PREVIEW", official: false });
    const raw = acceptClientObservation(submission(), preview.context);
    const outcome = scoreResponse(preview.single, preview.singleSpec, { kind: "SINGLE_SELECT", optionId: "a" });
    expect(() => verifyObservation(raw, { outcome, release: null, revocations: [], moderation: null, recordedBy: { kind: "SYSTEM", id: "s", role: null }, recordedAt: "2026-11-01T10:00:06.000Z", assistanceLedger: sealedAssistanceRecord(raw) })).toThrow("assessment_unreleased_evidence_cannot_be_verified");
    const env = setup();
    const raw2 = acceptClientObservation(submission(), env.context);
    const { revocation } = revokeRelease({ release: env.release, actor: LEAD, reason: "Key error discovered after release", revokedAt: "2026-11-01T09:00:00.000Z", evidenceDisposition: "INVALIDATE" });
    expect(() => verifyObservation(raw2, { outcome, release: env.release, revocations: [revocation], moderation: null, recordedBy: { kind: "SYSTEM", id: "s", role: null }, recordedAt: "2026-11-01T10:00:06.000Z", assistanceLedger: sealedAssistanceRecord(raw2) })).toThrow("assessment_release_revoked");
  });

  it("requires a SCORED outcome; pending moderation is not verified evidence", () => {
    const env = setup();
    const raw = acceptClientObservation(submission(), env.context);
    const pending = { ...scoreResponse(env.single, env.singleSpec, { kind: "SINGLE_SELECT", optionId: "a" }), status: "PENDING_HUMAN_MODERATION" as const, points: null, scorerAuthority: null };
    expect(() => verifyObservation(raw, { outcome: pending, release: env.release, revocations: [], moderation: null, recordedBy: { kind: "SYSTEM", id: "s", role: null }, recordedAt: "2026-11-01T10:00:06.000Z", assistanceLedger: sealedAssistanceRecord(raw) })).toThrow("assessment_outcome_not_scored");
  });

  it("keeps provisional feedback provisional", () => {
    const { raw } = verifiedChain();
    const provisional = createProvisionalFeedback(raw, { authority: "AI_SUGGESTION", recordedAt: "2026-11-01T10:00:07.000Z" });
    expect(provisional.tier).toBe("PROVISIONAL_FEEDBACK");
    expect(() => verifyObservation(provisional, { outcome: {} as never, release: null, revocations: [], moderation: null, recordedBy: { kind: "SYSTEM", id: "s", role: null }, recordedAt: "2026-11-01T10:00:06.000Z", assistanceLedger: sealedAssistanceRecord(provisional) })).toThrow("assessment_evidence_parent_tier_invalid");
    expect(() => admitToMastery(provisional, { policy: admission, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(provisional) })).toThrow("assessment_evidence_parent_tier_invalid");
  });

  it("admits verified independent official evidence only under a policy", () => {
    const { verified } = verifiedChain();
    expect(() => admitToMastery(verified, { policy: null, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(verified) })).toThrow("assessment_admission_policy_required");
    expect(() => admitToMastery(verified, { policy: { ...admission, admissiblePurposes: ["SUMMATIVE"] }, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(verified) })).toThrow("assessment_purpose_not_admissible");
    expect(() => admitToMastery(verified, { policy: { ...admission, objectiveIds: ["obj-other"] }, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(verified) })).toThrow("assessment_objective_not_governed_by_policy");
    const { evidence } = admitToMastery(verified, { policy: admission, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(verified) });
    expect(evidence).toMatchObject({ tier: "MASTERY_ADMITTED_EVIDENCE", derivedFromEvidenceId: verified.evidenceId, admission: { policyId: "admit-g7-math" } });
    const practice = verifiedChain(setup({ mode: "PRACTICE_UNOFFICIAL", official: false }));
    expect(() => admitToMastery(practice.verified, { policy: admission, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(practice.verified) })).toThrow("assessment_unofficial_delivery_not_admissible");
  });
});

describe("Append-only ledger: replay, conflicts and forgery", () => {
  it("treats exact replays as no-ops and conflicting payloads as errors", () => {
    const { raw, env } = verifiedChain();
    let ledger = appendEvidence(emptyLedger(), raw).ledger;
    const replay = appendEvidence(ledger, raw);
    expect(replay.appended).toBe(false);
    const conflicting = acceptClientObservation(submission({ responseDigest: "sha256:different", responseId: "resp-2" }), env.context);
    expect(conflicting.idempotencyKey).toBe(raw.idempotencyKey);
    expect(() => appendEvidence(ledger, conflicting)).toThrow("assessment_evidence_idempotency_conflict");
    ledger = appendEvidence(ledger, acceptClientObservation(submission({ responseSequence: 1 }), env.context)).ledger;
    expect(ledger.entries).toHaveLength(2);
  });

  it("rejects tampered envelopes and forged mastery evidence", () => {
    const { raw, verified } = verifiedChain();
    const { evidence: admitted } = admitToMastery(verified, { policy: admission, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(verified) });
    expect(() => appendEvidence(emptyLedger(), { ...raw, scope: { ...raw.scope, studentId: "stu-2" } })).toThrow("assessment_evidence_tampered");
    // Admitted evidence with no verified parent in the ledger.
    expect(() => appendEvidence(appendEvidence(emptyLedger(), raw).ledger, admitted)).toThrow("assessment_evidence_parent_missing");
    let ledger = appendEvidence(emptyLedger(), raw).ledger;
    ledger = appendEvidence(ledger, verified).ledger;
    // Re-sealed forgery that inflates points relative to the verified parent.
    const { evidenceHash: _h, ...unsealed } = admitted;
    const inflatedBody = { ...unsealed, scoring: { ...admitted.scoring, points: 5 } };
    const inflated = { ...inflatedBody, evidenceHash: hashEvidence(inflatedBody) } as AssessmentEvidenceEnvelope;
    expect(() => appendEvidence(ledger, inflated)).toThrow("assessment_evidence_derivation_altered");
    // Raw observation re-labelled as verified without scoring authority.
    const { evidenceHash: _r, ...rawBody } = raw;
    const relabelledBody = { ...rawBody, tier: "VERIFIED_ASSESSMENT_EVIDENCE" as const, evidenceId: "ver_forged", idempotencyKey: "forged", derivedFromEvidenceId: raw.evidenceId };
    expect(() => appendEvidence(ledger, { ...relabelledBody, evidenceHash: hashEvidence(relabelledBody) })).toThrow("assessment_verified_requires_scoring_authority");
    expect(appendEvidence(ledger, admitted).appended).toBe(true);
  });

  it("orders offline events by device sequence, not arrival, and surfaces conflicts", () => {
    const env = setup();
    const offline = (sequence: number, digest: string, responseSequence = sequence) => acceptClientObservation(submission({
      responseSequence, responseDigest: digest, responseId: `r-${digest}`,
      capture: { source: "OFFLINE", deviceId: "tablet-7", clientEventId: `e-${sequence}-${digest}`, clientSequence: sequence, capturedAt: "2026-11-01T09:00:00.000Z", syncBatchId: "batch-1" },
    }), env.context);
    const arrival = [offline(2, "c"), offline(0, "a"), offline(1, "b")];
    expect(orderForReplay(arrival).ordered.map((entry) => entry.capture.clientSequence)).toEqual([0, 1, 2]);
    const { conflicts } = orderForReplay([offline(0, "a"), offline(3, "z", 0)]);
    expect(conflicts).toHaveLength(1);
    expect(() => acceptClientObservation(submission({ capture: { ...submission().capture, source: "OFFLINE", deviceId: null } }), env.context)).toThrow("assessment_offline_device_required");
  });

  it("re-labels, never deletes, evidence when a release is revoked", () => {
    const { verified, env } = verifiedChain();
    const retain = revokeRelease({ release: env.release, actor: LEAD, reason: "Superseded by corrected form", revokedAt: "2026-12-01T00:00:00.000Z", evidenceDisposition: "RETAIN_AS_UNOFFICIAL" }).revocation;
    expect(effectiveStanding(verified, [retain])).toEqual({ tier: "VERIFIED_ASSESSMENT_EVIDENCE", official: false });
    const invalidate = { ...retain, evidenceDisposition: "INVALIDATE" as const };
    expect(effectiveStanding(verified, [invalidate]).tier).toBe("INVALIDATED");
  });
});

describe("Downstream consumers", () => {
  it("keeps downstream writes disabled in this foundation", () => {
    expect(ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED).toBe(false);
  });

  it("gives the SLM admitted evidence only, mapped to the existing governed evidence contract", () => {
    const { raw, verified } = verifiedChain();
    const { evidence: admitted } = admitToMastery(verified, { policy: admission, revocations: [], admittedAt: "2026-11-01T10:01:00.000Z", assistanceLedger: sealedAssistanceRecord(verified) });
    expect(evidenceForStudentLearningModel([raw, verified, admitted], [])).toEqual([admitted]);
    const governed = toGovernedLearningEvidence(admitted, { objectiveId: "obj-compare", conceptId: "concept-decimal-compare" });
    expect(() => validateGovernedEvidence(governed)).not.toThrow();
    expect(governed.canonicalMasteryMutation).toBe(false);
    expect(() => toGovernedLearningEvidence(verified, { objectiveId: "obj-compare", conceptId: "c" })).toThrow("assessment_slm_requires_admitted_evidence");
  });

  it("lets the orchestrator read diagnostics without a mastery claim", () => {
    const { raw } = verifiedChain(setup({ purpose: "DIAGNOSTIC" }));
    const [signal] = signalsForOrchestrator([raw], []);
    expect(signal).toMatchObject({ tier: "RAW_OBSERVATION", purpose: "DIAGNOSTIC", masteryClaim: false, fractionCorrect: null });
  });

  it("admits only official verified scores to the gradebook under an approved school grading policy", () => {
    const { raw, verified } = verifiedChain();
    const policy = { schoolId: SCHOOL, policyId: "grading-2026", version: "1", status: "APPROVED" as const };
    expect(gradebookEligibility(verified, { gradingPolicy: null, revocations: [] }).reason).toBe("grading_policy_missing");
    expect(gradebookEligibility(verified, { gradingPolicy: { ...policy, status: "DRAFT" }, revocations: [] }).reason).toBe("grading_policy_not_approved");
    expect(gradebookEligibility(verified, { gradingPolicy: { ...policy, schoolId: "school-2" }, revocations: [] }).reason).toBe("grading_policy_school_mismatch");
    expect(gradebookEligibility(raw, { gradingPolicy: policy, revocations: [] }).reason).toBe("evidence_not_verified");
    expect(gradebookEligibility(verified, { gradingPolicy: policy, revocations: [] })).toEqual({ eligible: true, reason: "official_verified_score" });
    const practice = verifiedChain(setup({ mode: "PRACTICE_UNOFFICIAL", official: false })).verified;
    expect(gradebookEligibility(practice, { gradingPolicy: policy, revocations: [] }).reason).toBe("delivery_not_official");
  });

  it("reports missing evidence as NO_EVIDENCE, never as zero", () => {
    expect(summarizeObjectiveEvidence([], "obj-compare", [])).toEqual({ status: "NO_EVIDENCE", objectiveId: "obj-compare" });
    const { raw, verified } = verifiedChain();
    expect(summarizeObjectiveEvidence([raw], "obj-compare", []).status).toBe("ONLY_UNVERIFIED");
    expect(summarizeObjectiveEvidence([raw, verified], "obj-compare", [])).toMatchObject({ status: "VERIFIED", pointsEarned: 1, pointsPossible: 1, independentCount: 1 });
  });
});

describe("Retention and transfer", () => {
  const approved: RetentionSchedulePolicy = { ...PROPOSED_RETENTION_POLICY, policyId: "g7-math-retention", status: "APPROVED", scope: { grade: 7, subject: "MATH" } };

  it("does not apply the 7/21-day proposal until a grade/subject policy is approved", () => {
    expect(resolveRetentionPolicy([PROPOSED_RETENTION_POLICY], 7, "MATH")).toBeNull();
    expect(planRetentionOpportunities({ studentId: "stu-1", objectiveIds: ["obj-compare"], instructionCompletedAt: "2026-11-01T00:00:00.000Z", policy: PROPOSED_RETENTION_POLICY })).toEqual([]);
    expect(resolveRetentionPolicy([approved, { ...approved, policyId: "all", scope: { grade: null, subject: null } }], 7, "MATH")?.policyId).toBe("g7-math-retention");
    expect(resolveRetentionPolicy([approved], 8, "MATH")).toBeNull();
  });

  it("treats scheduled checks as opportunities, and only verified independent delayed responses as retention evidence", () => {
    const [week] = planRetentionOpportunities({ studentId: "stu-1", objectiveIds: ["obj-compare"], instructionCompletedAt: "2026-10-20T00:00:00.000Z", policy: approved });
    expect(week).toMatchObject({ intervalDays: 7, dueAt: "2026-10-27T00:00:00.000Z", isEvidence: false });
    expect(classifyRetentionEvidence(week, null, approved)).toEqual({ kind: "NOT_RETENTION_EVIDENCE", reason: "opportunity_not_completed" });
    const { raw, verified } = verifiedChain(setup({ purpose: "RETENTION" }));
    expect(classifyRetentionEvidence(week, raw, approved).kind).toBe("NOT_RETENTION_EVIDENCE");
    expect(classifyRetentionEvidence(week, verified, approved)).toMatchObject({ kind: "RETENTION_EVIDENCE", delayDays: 12 });
    const early = { ...week, instructionCompletedAt: "2026-10-30T00:00:00.000Z" };
    expect(classifyRetentionEvidence(early, verified, approved)).toEqual({ kind: "NOT_RETENTION_EVIDENCE", reason: "insufficient_delay" });
    const assisted = verifiedChain(setup({ purpose: "RETENTION" }), submission({ assistance: { ...NONE, hintsRevealed: 2 } })).verified;
    expect(classifyRetentionEvidence(week, assisted, approved)).toEqual({ kind: "NOT_RETENTION_EVIDENCE", reason: "assisted_response" });
    const formative = verifiedChain().verified;
    expect(classifyRetentionEvidence(week, formative, approved).kind).toBe("NOT_RETENTION_EVIDENCE");
  });

  it("requires a NEW-context item for transfer evidence", () => {
    const { verified, env } = verifiedChain();
    expect(classifyTransferEvidence(verified, env.single)).toEqual({ transfer: false, reason: "item_context_not_new" });
    expect(classifyTransferEvidence(null, env.worked).transfer).toBe(false);
  });

  it("reports blueprint gaps against the Curriculum Excellence standard", () => {
    const { single, worked, items } = buildItems();
    const map = new Map(items.map((item) => [`${item.itemId}@${item.version}`, item]));
    const gaps = blueprintGaps({
      lessonId: "l1", lessonVersion: "1", objectiveIds: ["obj-compare"], prerequisiteObjectiveIds: ["obj-place-value"],
      requiresOriginalProduct: true, retentionPolicyRef: null,
      entries: [
        { slot: "END_OF_LESSON_INDEPENDENT", itemId: single.itemId, itemVersion: single.version, objectiveIds: ["obj-compare"], misconceptionRemediation: [] },
        { slot: "TRANSFER", itemId: single.itemId, itemVersion: single.version, objectiveIds: ["obj-compare"], misconceptionRemediation: [] },
        { slot: "HIGHER_ORDER", itemId: worked.itemId, itemVersion: worked.version, objectiveIds: ["obj-compare"], misconceptionRemediation: [] },
      ],
    }, map);
    expect(gaps).toEqual(expect.arrayContaining([
      "prerequisite_diagnostic_missing:obj-place-value", "delayed_retention_missing", "transfer_item_not_new_context:i-single",
      "original_product_missing", "remediation_missing:i-single:mc-longer-decimal-bigger",
    ]));
    expect(gaps).not.toContain("higher_order_missing");
  });
});

describe("Compatibility adapters", () => {
  const g7 = {
    lessonKey: "math-number-sense-place-value",
    status: "GOVERNED_CANDIDATE",
    authors: [{ kind: "AI", agentId: "claude-code:curriculum-excellence-v1" }],
    tasks: [
      { id: "pm-d0", kind: "PREREQUISITE_DIAGNOSTIC", objectiveIds: ["ll-g7-math-place-value-digit-value"], context: "REHEARSED", scoring: "KEYED", prompt: "In 45,384, what is the 3 worth?", key: "300" },
      { id: "pm-t1", kind: "TRANSFER_TASK", objectiveIds: ["ll-g7-math-place-value-compare"], context: "NEW", scoring: "ANALYTIC_RUBRIC", prompt: "Place 2.35 and 2.305 on a number line from 2.3 to 2.4.", scoringGuide: { "2": "2.305 is closer, explained with the marks", "1": "Correct answer, imprecise placement", "0": "Says 2.35 is closer" }, targetsMisconceptions: ["mc-longer-decimal-bigger"] },
      { id: "pm-dr2", kind: "DELAYED_RETRIEVAL", objectiveIds: ["ll-g7-math-place-value-compare"], timing: "DELAYED", delayDays: 21, scoring: "ANALYTIC_RUBRIC", prompt: "Which is greater, 0.6 or 0.599? Explain.", scoringGuide: { "2": "0.6, explained by tenths", "1": "0.6 with no valid reason", "0": "0.599" } },
    ],
  };

  it("adapts G7 v0.3.0 candidate tasks as unapproved candidates with protected keys", () => {
    const adapted = adaptG7CandidateTasks(g7, { version: "0.3.0", sourceRef: "curriculum/v2/g7/assessment-definitions/math-number-sense-place-value.json" });
    expect(adapted.map((entry) => [entry.purpose, entry.item.itemType, entry.status])).toEqual([
      ["DIAGNOSTIC", "SHORT_CONSTRUCTED", "CANDIDATE"], ["TRANSFER", "WORKED_SOLUTION", "CANDIDATE"], ["RETENTION", "WORKED_SOLUTION", "CANDIDATE"],
    ]);
    expect(adapted[2].delayDays).toBe(21);
    for (const { item, spec } of adapted) {
      expect(validateItem(item, spec).ok).toBe(true);
      const state = deriveContentStatus({ current: { kind: "ITEM", itemId: item.itemId, version: item.version, hash: item.itemHash }, provenance: item.provenance, validation: validateItem(item, spec), reviews: [], policy: defaultReviewPolicy("FORMATIVE") });
      expect(state.status).toBe("VALIDATED");
      expect(item.provenance.authors[0].kind).toBe("AI");
      const projected = projectItemForLearner(item, { attemptId: "a", points: 1, independent: false });
      expect(() => assertLearnerSafe(projected, protectedStrings([item], [spec]))).not.toThrow();
      // Keyed paper answers are held for human scoring, never exact-match auto-scored.
      if (spec.key.kind === "SHORT_CONSTRUCTED") expect(spec.key.autoScore).toBe("HUMAN_ONLY");
    }
    expect(JSON.stringify(adapted.map((entry) => projectItemForLearner(entry.item, { attemptId: "a", points: 1, independent: false })))).not.toContain("2.305 is closer");
  });

  it("imports legacy exam questions as candidates with the key moved server-side", () => {
    const { item, spec, status } = legacyExamQuestionToCandidate({ id: "q1", examId: "e1", prompt: "2+2?", options: ["3", "4"], correctIndex: 1, explanation: "Two plus two is four.", moeCode: "M1", points: 1 }, { version: "1", createdBy: "teacher-1", grade: 4 });
    expect(status).toBe("CANDIDATE");
    expect(spec.key).toEqual({ kind: "SINGLE_SELECT", correctOptionId: "o1" });
    expect(JSON.stringify(item)).not.toContain("correctIndex");
    expect(JSON.stringify(item)).not.toContain("Two plus two is four.");
  });

  it("resolves ContentBundle assessment pointers by exact version only", () => {
    const { definition, single } = buildReleased();
    const registry = { definitions: new Map([[`${definition.definitionId}@${definition.version}`, definition]]), items: new Map([[`${single.itemId}@${single.version}`, single]]) };
    const reference = {
      identity: { itemId: "b-quiz", itemVersion: "1", itemKind: "QUIZ" as const }, role: "QUIZ" as const, title: "Quiz", objectiveIds: ["obj-compare"],
      definition: { definitionId: definition.definitionId, definitionVersion: definition.version },
      items: [{ assessmentItemId: single.itemId, assessmentItemVersion: single.version }], itemOrder: { kind: "FIXED" as const }, learnerInstructions: [],
      secured: { answerKeyResourceId: null, scoringGuideResourceId: null },
    };
    expect(resolveBundleAssessmentReference(reference, registry).items).toEqual([single]);
    expect(() => resolveBundleAssessmentReference({ ...reference, definition: { ...reference.definition, definitionVersion: "2.0.0" } }, registry)).toThrow("assessment_bundle_definition_unresolved");
    expect(() => resolveBundleAssessmentReference({ ...reference, items: [{ assessmentItemId: single.itemId, assessmentItemVersion: "0.9" }] }, registry)).toThrow("assessment_bundle_item_unresolved");
    expect(() => resolveBundleAssessmentReference({ ...reference, objectiveIds: ["obj-unmeasured"] }, registry)).toThrow("assessment_bundle_objective_not_measured");
  });
});
