/**
 * F1 regression suite (docs/architecture/learning-loop/INTEGRATION_BOUNDARIES_HANDOFF_V1.md §0, §A.4).
 *
 * A client's assistance declaration can only weaken evidence. Independence comes from the server's
 * attempt-scoped assistance record, sealed with the attempt. Missing, unsealed, broken, conflicting or
 * wrongly scoped records never yield INDEPENDENT, so they never reach mastery admission.
 */
import { describe, expect, it } from "vitest";
import {
  acceptClientObservation,
  admitToMastery,
  appendAssistance,
  appendEvidence,
  ASSESSMENT_EVIDENCE_CONTRACT_VERSION,
  ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED,
  ASSISTANCE_LEDGER_PRODUCTION_ENABLED,
  classifyAssistanceForItem,
  emptyAssistanceLedger,
  emptyLedger,
  hashEvidence,
  requiresIntegrityReview,
  scoreResponse,
  verifyObservation,
  type AssessmentEvidenceEnvelope,
  type AssistanceExposure,
  type AssistanceLedger,
  type AssistanceLedgerScope,
  type ClientObservationSubmission,
  type MasteryAdmissionPolicy,
  type ServerAttemptContext,
} from "@/lib/assessment/v2";
import { buildReleased, CURRICULUM, SCHOOL } from "./fixtures";

const NONE: AssistanceExposure = { hintsRevealed: 0, aiTutorUsed: false, explanationSeenBeforeResponse: false, answerRevealedBeforeResponse: false, prohibitedToolUsed: false, peerCollaboration: false };
const ALL_CHANNELS = ["TUTOR", "HINTS", "EXPLANATIONS", "ANSWERS", "TOOLS", "PEERS"] as const;
const policy: MasteryAdmissionPolicy = { policyId: "admit-g7-math", version: "1.0.0", admissiblePurposes: ["FORMATIVE", "SUMMATIVE", "RETENTION", "TRANSFER"], requireOfficialDelivery: true, objectiveIds: ["obj-compare"] };
const T = (seconds: number) => new Date(Date.parse("2026-11-01T10:00:00.000Z") + seconds * 1000).toISOString();

function setup(purpose: ServerAttemptContext["delivery"]["purpose"] = "SUMMATIVE") {
  const released = buildReleased();
  const { single, release, form, definition } = released;
  const context: ServerAttemptContext = {
    session: { studentId: "stu-1", studentUserId: "user-1", schoolId: SCHOOL, tenantId: "tenant-1" },
    attempt: { attemptId: "att-1", sessionId: "ses-1", studentId: "stu-1", schoolId: SCHOOL, enrollmentId: "enr-1", classId: "class-1", status: "OPEN" },
    pins: {
      definitionId: definition.definitionId, definitionVersion: definition.version, definitionHash: definition.contentHash,
      formId: form.formId, formVersion: form.version, formHash: form.formHash,
      itemId: single.itemId, itemVersion: single.version, itemHash: single.itemHash, scoringSpecHash: single.scoringSpecHash,
      releaseId: release.releaseId, releaseHash: release.releaseHash,
      curriculumReleaseId: CURRICULUM.releaseId, curriculumReleaseIdentity: CURRICULUM.releaseIdentity,
    },
    objectiveIds: ["obj-compare"],
    delivery: { mode: "OFFICIAL", official: true, purpose, itemContext: "REHEARSED", runtime: "WEB", accommodations: [], allowedToolIds: [] },
    receivedAt: T(5),
  };
  const scope: AssistanceLedgerScope = { tenantId: "tenant-1", schoolId: SCHOOL, studentId: "stu-1", attemptId: "att-1", sessionId: "ses-1", releaseId: release.releaseId, releaseHash: release.releaseHash };
  return { ...released, context, scope };
}

function submission(overrides: Partial<ClientObservationSubmission> = {}): ClientObservationSubmission {
  return {
    attemptId: "att-1", itemId: "i-single", itemVersion: "1.0.0", responseSequence: 0, responseId: "resp-1", responseDigest: "sha256:a",
    assistance: NONE,
    capture: { source: "ONLINE", deviceId: null, clientEventId: "evt-1", clientSequence: 0, capturedAt: T(1), syncBatchId: null },
    ...overrides,
  };
}

/** A server-side ledger opened with the attempt and sealed at submission, optionally with assistance. */
function ledgerFor(scope: AssistanceLedgerScope, steps: { assist?: "TUTOR" | "HINT"; seal?: boolean; instrumented?: readonly (typeof ALL_CHANNELS)[number][] } = {}): AssistanceLedger {
  let ledger = emptyAssistanceLedger(scope);
  ledger = appendAssistance(ledger, { scope, recordedAt: T(0), event: { type: "OPENED", availableChannels: [...ALL_CHANNELS], instrumentedChannels: [...(steps.instrumented ?? ALL_CHANNELS)], independentDelivery: true, offlineDeviceIds: ["dev-1"] } }).ledger;
  if (steps.assist === "TUTOR") ledger = appendAssistance(ledger, { scope, recordedAt: T(2), event: { type: "ASSISTANCE", kind: "TUTOR_TURN", itemId: null, provenance: { emitter: "SERVER_TUTOR_ROUTE", tutorInteractionId: "tut-1" } } }).ledger;
  if (steps.assist === "HINT") ledger = appendAssistance(ledger, { scope, recordedAt: T(2), event: { type: "ASSISTANCE", kind: "HINT_REVEALED", itemId: "i-single", provenance: { emitter: "SERVER_HINT_PROJECTION", hintId: "h1" } } }).ledger;
  if (steps.seal !== false) ledger = appendAssistance(ledger, { scope, recordedAt: T(10), event: { type: "SEALED", reason: "SUBMITTED" } }).ledger;
  return ledger;
}

function verify(env: ReturnType<typeof setup>, raw: AssessmentEvidenceEnvelope, assistanceLedger: AssistanceLedger | null) {
  const outcome = scoreResponse(env.single, env.singleSpec, { kind: "SINGLE_SELECT", optionId: "a" });
  return verifyObservation(raw, { outcome, release: env.release, revocations: [], moderation: null, recordedBy: { kind: "SYSTEM", id: "scorer", role: null }, recordedAt: T(11), assistanceLedger });
}

const admit = (verified: AssessmentEvidenceEnvelope, assistanceLedger: AssistanceLedger | null) =>
  admitToMastery(verified, { policy, revocations: [], admittedAt: T(20), assistanceLedger });

describe("F1: client declarations cannot prove independence", () => {
  it("uses the 1.1.0 evidence contract and keeps every write switched off", () => {
    expect(ASSESSMENT_EVIDENCE_CONTRACT_VERSION).toBe("assessment-evidence/1.1.0");
    expect(ASSISTANCE_LEDGER_PRODUCTION_ENABLED).toBe(false);
    expect(ASSESSMENT_V2_DOWNSTREAM_WRITES_ENABLED).toBe(false);
  });

  it("a raw observation declaring no assistance is UNVERIFIED, never INDEPENDENT", () => {
    const raw = acceptClientObservation(submission(), setup().context);
    expect(raw.independence).toBe("UNVERIFIED");
    expect(raw.assistanceAttestation).toBeNull();
  });

  it("omitted assistance metadata is refused, not read as 'no assistance'", () => {
    const { assistance: _omitted, ...rest } = submission();
    expect(() => acceptClientObservation(rest as never, setup().context)).toThrow("assessment_assistance_invalid");
  });

  it("a declaration of assistance makes the raw observation ASSISTED", () => {
    const raw = acceptClientObservation(submission({ assistance: { ...NONE, hintsRevealed: 1 } }), setup().context);
    expect(raw.independence).toBe("ASSISTED");
  });

  it("missing ledger: verified evidence is UNVERIFIED and admission refuses it", () => {
    const env = setup();
    const { evidence } = verify(env, acceptClientObservation(submission(), env.context), null);
    expect(evidence.independence).toBe("UNVERIFIED");
    expect(evidence.integrityFlags).toContain("assistance_record_missing");
    expect(() => admit(evidence, null)).toThrow("assessment_assisted_evidence_not_admissible");
  });

  it("falsified 'no assistance' against a ledger that recorded the AI tutor: ASSISTED, integrity review, not admissible", () => {
    const env = setup();
    const ledger = ledgerFor(env.scope, { assist: "TUTOR" });
    const result = verify(env, acceptClientObservation(submission(), env.context), ledger);
    expect(result.evidence.independence).toBe("ASSISTED");
    expect(result.evidence.assistance.aiTutorUsed).toBe(true);
    expect(result.evidence.integrityFlags).toEqual(expect.arrayContaining(["assistance_declaration_ledger_conflict", "ai_tutor_used_during_independent_assessment"]));
    expect(requiresIntegrityReview(result.evidence)).toBe(true);
    expect(result.integrityReview?.type).toBe("assessment.evidence.integrity_review_required");
    expect(() => admit(result.evidence, ledger)).toThrow("assessment_assisted_evidence_not_admissible");
  });

  it("a client that declares help the ledger did not see stays ASSISTED and is flagged for review", () => {
    const env = setup();
    const result = verify(env, acceptClientObservation(submission({ assistance: { ...NONE, peerCollaboration: true } }), env.context), ledgerFor(env.scope));
    expect(result.evidence.independence).toBe("ASSISTED");
    expect(requiresIntegrityReview(result.evidence)).toBe(true);
  });

  it("an unsealed ledger cannot attest independence", () => {
    const env = setup();
    const { evidence } = verify(env, acceptClientObservation(submission(), env.context), ledgerFor(env.scope, { seal: false }));
    expect(evidence.independence).toBe("UNVERIFIED");
    expect(evidence.integrityFlags).toContain("assistance_ledger_not_sealed");
  });

  it("an uninstrumented assistance channel cannot attest independence", () => {
    const env = setup();
    const { evidence } = verify(env, acceptClientObservation(submission(), env.context), ledgerFor(env.scope, { instrumented: ["TUTOR", "HINTS", "ANSWERS", "TOOLS", "PEERS"] }));
    expect(evidence.independence).toBe("UNVERIFIED");
    expect(evidence.integrityFlags.some((flag) => flag.startsWith("assistance_channels_not_instrumented:EXPLANATIONS"))).toBe(true);
  });

  it("a ledger for another attempt, session or release is treated as missing and flagged for review", () => {
    const env = setup();
    for (const other of [{ attemptId: "att-2" }, { sessionId: "ses-2" }, { releaseHash: "other" }, { studentId: "stu-2" }]) {
      const result = verify(env, acceptClientObservation(submission(), env.context), ledgerFor({ ...env.scope, ...other }));
      expect(result.evidence.independence).toBe("UNVERIFIED");
      expect(result.evidence.integrityFlags).toContain("assistance_record_scope_mismatch");
      expect(requiresIntegrityReview(result.evidence)).toBe(true);
    }
  });

  it("a tampered ledger (assistance entry removed) cannot attest independence", () => {
    const env = setup();
    const honest = ledgerFor(env.scope, { assist: "TUTOR" });
    const tampered: AssistanceLedger = { ...honest, entries: honest.entries.filter((entry) => entry.event.type !== "ASSISTANCE") };
    const result = verify(env, acceptClientObservation(submission(), env.context), tampered);
    expect(result.evidence.independence).toBe("UNVERIFIED");
    expect(result.evidence.integrityFlags).toContain("assistance_ledger_chain_invalid");
    expect(requiresIntegrityReview(result.evidence)).toBe(true);
  });

  it("only a sealed, complete, assistance-free record yields INDEPENDENT, and admission re-checks the record", () => {
    const env = setup();
    const ledger = ledgerFor(env.scope);
    const { evidence } = verify(env, acceptClientObservation(submission(), env.context), ledger);
    expect(evidence.independence).toBe("INDEPENDENT");
    expect(evidence.assistanceAttestation).toMatchObject({ attemptId: "att-1", sessionId: "ses-1", itemId: "i-single", status: "INDEPENDENT" });
    expect(() => admit(evidence, null)).toThrow("assessment_assistance_record_missing");
    const { evidence: admitted } = admit(evidence, ledger);
    expect(admitted.tier).toBe("MASTERY_ADMITTED_EVIDENCE");
  });

  it("admission refuses when the record changed after verification (late offline assistance)", () => {
    const env = setup();
    const ledger = ledgerFor(env.scope);
    const { evidence } = verify(env, acceptClientObservation(submission(), env.context), ledger);
    const later = appendAssistance(ledger, { scope: env.scope, recordedAt: T(15), event: { type: "ASSISTANCE", kind: "ANSWER_SHOWN", itemId: "i-single", provenance: { emitter: "OFFLINE_DEVICE_REPLAY", deviceId: "dev-1", clientSequence: 3, syncBatchId: "b1", capturedAt: T(3) } } }).ledger;
    expect(() => admit(evidence, later)).toThrow("assessment_assistance_attestation_stale");
  });

  it("assisted evidence stays ineligible: hints in the record make it ASSISTED", () => {
    const env = setup();
    const ledger = ledgerFor(env.scope, { assist: "HINT" });
    const { evidence } = verify(env, acceptClientObservation(submission(), env.context), ledger);
    expect(evidence.independence).toBe("ASSISTED");
    expect(evidence.assistance.hintsRevealed).toBe(1);
    expect(() => admit(evidence, ledger)).toThrow("assessment_assisted_evidence_not_admissible");
  });
});

describe("F1: the evidence ledger refuses forged independence", () => {
  function chain(env: ReturnType<typeof setup>, ledger: AssistanceLedger | null) {
    const raw = acceptClientObservation(submission(), env.context);
    const { evidence: verified } = verify(env, raw, ledger);
    return { raw, verified };
  }
  const reseal = (envelope: Omit<AssessmentEvidenceEnvelope, "evidenceHash"> & { evidenceHash?: string }) => ({ ...envelope, evidenceHash: hashEvidence(envelope as AssessmentEvidenceEnvelope) }) as AssessmentEvidenceEnvelope;

  it("refuses a raw observation that claims INDEPENDENT", () => {
    const env = setup();
    const { raw } = chain(env, null);
    expect(() => appendEvidence(emptyLedger(), reseal({ ...raw, independence: "INDEPENDENT" }))).toThrow("assessment_raw_observation_invalid");
  });

  it("refuses a verified envelope upgraded to INDEPENDENT without an attestation", () => {
    const env = setup();
    const { raw, verified } = chain(env, null);
    const ledger = appendEvidence(emptyLedger(), raw).ledger;
    expect(() => appendEvidence(ledger, reseal({ ...verified, independence: "INDEPENDENT" }))).toThrow("assessment_evidence_derivation_altered");
  });

  it("refuses ASSISTED → INDEPENDENT and refuses lowering recorded exposure", () => {
    const env = setup();
    const raw = acceptClientObservation(submission({ assistance: { ...NONE, aiTutorUsed: true } }), env.context);
    const { evidence: verified } = verify(env, raw, ledgerFor(env.scope, { assist: "TUTOR" }));
    const ledger = appendEvidence(emptyLedger(), raw).ledger;
    expect(() => appendEvidence(ledger, reseal({ ...verified, independence: "INDEPENDENT" }))).toThrow("assessment_evidence_derivation_altered");
    expect(() => appendEvidence(ledger, reseal({ ...verified, assistance: NONE }))).toThrow("assessment_evidence_derivation_altered");
  });

  it("refuses an admitted envelope whose attestation is not INDEPENDENT", () => {
    const env = setup();
    const assistance = ledgerFor(env.scope);
    const { raw, verified } = chain(env, assistance);
    const { evidence: admitted } = admit(verified, assistance);
    let ledger = appendEvidence(emptyLedger(), raw).ledger;
    ledger = appendEvidence(ledger, verified).ledger;
    expect(appendEvidence(ledger, admitted).appended).toBe(true);
    const forged = reseal({ ...admitted, assistanceAttestation: { ...admitted.assistanceAttestation!, status: "UNVERIFIED" } });
    expect(() => appendEvidence(ledger, forged)).toThrow(/assessment_(evidence_derivation_altered|assisted_evidence_not_admissible)/);
  });

  it("refuses envelopes from the 1.0.0 contract", () => {
    const env = setup();
    const { raw } = chain(env, null);
    expect(() => appendEvidence(emptyLedger(), reseal({ ...raw, contractVersion: "assessment-evidence/1.0.0" as never }))).toThrow("assessment_evidence_contract_unsupported");
  });
});

describe("Assistance record: append-only, server-timed, replay-safe", () => {
  const scope = (): AssistanceLedgerScope => setup().scope;
  const open = (s: AssistanceLedgerScope) => appendAssistance(emptyAssistanceLedger(s), { scope: s, recordedAt: T(0), event: { type: "OPENED", availableChannels: [...ALL_CHANNELS], instrumentedChannels: [...ALL_CHANNELS], independentDelivery: true, offlineDeviceIds: ["dev-1"] } }).ledger;

  it("derives idempotency on the server: a replayed tutor turn is a no-op", () => {
    const s = scope();
    const event = { type: "ASSISTANCE" as const, kind: "TUTOR_TURN" as const, itemId: null, provenance: { emitter: "SERVER_TUTOR_ROUTE" as const, tutorInteractionId: "tut-1" } };
    const first = appendAssistance(open(s), { scope: s, recordedAt: T(2), event });
    const replay = appendAssistance(first.ledger, { scope: s, recordedAt: T(3), event });
    expect(replay.appended).toBe(false);
    expect(replay.ledger.entries).toHaveLength(2);
  });

  it("uses the server clock for online events", () => {
    const s = scope();
    const { ledger } = appendAssistance(open(s), { scope: s, recordedAt: T(2), event: { type: "ASSISTANCE", kind: "HINT_REVEALED", itemId: "i-single", provenance: { emitter: "SERVER_HINT_PROJECTION", hintId: "h1" } } });
    expect(ledger.entries[1].occurredAt).toBe(T(2));
  });

  it("records a conflicting offline replay instead of overwriting, and the item becomes UNVERIFIED with review", () => {
    const s = scope();
    const replay = (kind: "TOOL_USED" | "ANSWER_SHOWN") => ({ type: "ASSISTANCE" as const, kind, itemId: "i-single", provenance: { emitter: "OFFLINE_DEVICE_REPLAY" as const, deviceId: "dev-1", clientSequence: 7, syncBatchId: "b1", capturedAt: T(2) } });
    let ledger = appendAssistance(open(s), { scope: s, recordedAt: T(4), event: replay("TOOL_USED") }).ledger;
    const conflict = appendAssistance(ledger, { scope: s, recordedAt: T(5), event: replay("ANSWER_SHOWN") });
    expect(conflict.conflict).toBe(true);
    ledger = appendAssistance(conflict.ledger, { scope: s, recordedAt: T(10), event: { type: "SEALED", reason: "SUBMITTED" } }).ledger;
    const classified = classifyAssistanceForItem(ledger, "i-single");
    expect(classified.status).toBe("UNVERIFIED");
    expect(classified.reasons).toContain("assistance_ledger_conflict");
  });

  it("refuses unbound offline devices, scope substitution, and online events after the seal", () => {
    const s = scope();
    const ledger = open(s);
    expect(() => appendAssistance(ledger, { scope: s, recordedAt: T(4), event: { type: "ASSISTANCE", kind: "TUTOR_TURN", itemId: null, provenance: { emitter: "OFFLINE_DEVICE_REPLAY", deviceId: "dev-9", clientSequence: 1, syncBatchId: "b", capturedAt: T(2) } } })).toThrow("assistance_offline_device_not_bound");
    expect(() => appendAssistance(ledger, { scope: { ...s, studentId: "stu-2" }, recordedAt: T(4), event: { type: "SEALED", reason: "SUBMITTED" } })).toThrow("assistance_scope_mismatch");
    const sealed = appendAssistance(ledger, { scope: s, recordedAt: T(10), event: { type: "SEALED", reason: "SUBMITTED" } }).ledger;
    expect(() => appendAssistance(sealed, { scope: s, recordedAt: T(11), event: { type: "ASSISTANCE", kind: "TUTOR_TURN", itemId: null, provenance: { emitter: "SERVER_TUTOR_ROUTE", tutorInteractionId: "tut-9" } } })).toThrow("assistance_ledger_sealed");
    expect(() => appendAssistance(sealed, { scope: s, recordedAt: T(12), event: { type: "ASSISTANCE", kind: "TUTOR_TURN", itemId: null, provenance: { emitter: "OFFLINE_DEVICE_REPLAY", deviceId: "dev-1", clientSequence: 2, syncBatchId: "b", capturedAt: T(11) } } })).toThrow("assistance_ledger_sealed");
  });

  it("refuses offline capture times outside the attempt window", () => {
    const s = scope();
    const ledger = open(s);
    const at = (capturedAt: string) => ({ type: "ASSISTANCE" as const, kind: "TUTOR_TURN" as const, itemId: null, provenance: { emitter: "OFFLINE_DEVICE_REPLAY" as const, deviceId: "dev-1", clientSequence: 1, syncBatchId: "b", capturedAt } });
    expect(() => appendAssistance(ledger, { scope: s, recordedAt: T(4), event: at(T(-60)) })).toThrow("assistance_event_before_open");
    expect(() => appendAssistance(ledger, { scope: s, recordedAt: T(4), event: at(T(4 + 600)) })).toThrow("assistance_capture_time_in_future");
  });
});
