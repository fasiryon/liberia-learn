// Library Modernization Ledger V1: authority, separation of duties, exact-hash binding and tamper
// evidence. Every rejection here is a governance rule, not a convenience check.
import { describe, expect, it } from "vitest";
import {
  answerLedgerQuestions, appendEvents, emptyLedger, hashEvent, replayLedger, LedgerRejection,
  type Ledger, type LedgerActor, type NewLedgerEvent,
} from "@/lib/curriculum/modernization/ledger";

const at = "2026-10-16T00:00:00.000Z";
const tool: LedgerActor = { kind: "AUTOMATED", id: "inventory-tool", role: "INVENTORY_TOOL" };
const mergeops: LedgerActor = { kind: "AUTOMATED", id: "mergeops", role: "MERGEOPS" };
const authorAi: LedgerActor = { kind: "AI_AGENT", id: "agent:author", role: "CANDIDATE_AUTHOR", modelFamily: "family-a" };
const sameFamilyAi: LedgerActor = { kind: "AI_AGENT", id: "agent:reviewer-a", role: "AI_REVIEWER", modelFamily: "family-a" };
const otherFamilyAi: LedgerActor = { kind: "AI_AGENT", id: "agent:reviewer-b", role: "AI_REVIEWER", modelFamily: "family-b" };
const humanReviewer: LedgerActor = { kind: "HUMAN", id: "reviewer:math-1", role: "CURRICULUM_REVIEWER" };
const assessmentReviewer: LedgerActor = { kind: "HUMAN", id: "reviewer:assess-1", role: "CURRICULUM_REVIEWER" };
const authority: LedgerActor = { kind: "HUMAN", id: "authority:cur-1", role: "CURRICULUM_AUTHORITY" };
const owner: LedgerActor = { kind: "HUMAN", id: "owner:cur-1", role: "GOVERNANCE_OWNER" };
const release: LedgerActor = { kind: "AUTOMATED", id: "release-system", role: "RELEASE_SYSTEM" };
const measurement: LedgerActor = { kind: "HUMAN", id: "measure:lead", role: "MEASUREMENT_LEAD" };

const L = "lesson-1";
const ev = (actor: LedgerActor, body: NewLedgerEvent["body"], contentId = L): NewLedgerEvent => ({ at, contentId, actor, body });
const live = (hash = "h-live-1", revisionId = "rev-1") => ev(tool, { type: "LIVE_OBSERVED", revisionId, contentHash: hash, status: "APPROVED", lifecycleState: "APPROVED", extractSha256: "x" });
const auditEv = (hash = "h-live-1", revisionId = "rev-1", digest = "d1") => ev(tool, { type: "AUDIT_RECORDED", revisionId, contentHash: hash, auditVersion: "v", auditDigest: digest, mechanicalOutcome: "REVISE", reviewOutcome: "REVISE", findings: { MAJOR: 3 } });
const candidate = (hash = "c-1", legacyHash = "h-live-1") => ev(authorAi, { type: "CANDIDATE_REGISTERED", candidateId: "cand", candidateVersion: "0.1.0", candidateHash: hash, manifestHash: "m", legacyRevisionId: "rev-1", legacyContentHash: legacyHash, authors: [authorAi] });
const review = (actor: LedgerActor, scope: "ACADEMIC" | "ASSESSMENT", decision: "ACCEPT" | "CHANGES_REQUESTED" = "ACCEPT", hash = "c-1") => ev(actor, { type: "REVIEW_RECORDED", candidateHash: hash, scope, decision, reportDigest: "r" });
const authorize = (actor: LedgerActor = authority, hash = "c-1") => ev(actor, { type: "RELEASE_AUTHORIZED", candidateHash: hash, legacyMappingPlanDigest: "plan", historyPolicy: "PRESERVE_HISTORICAL_PINS", futureAssignments: "TEACHER_OPT_IN" });

const build = (...events: NewLedgerEvent[]): Ledger => appendEvents(emptyLedger(), events);
const rejects = (fn: () => unknown, code: string) => {
  try { fn(); } catch (error) { expect(error).toBeInstanceOf(LedgerRejection); expect((error as LedgerRejection).code).toBe(code); return; }
  throw new Error(`expected ${code}`);
};
const stage = (ledger: Ledger) => ledger.lessons.get(L)!.stage;
const base = () => build(live(), auditEv(), candidate(), ev(authorAi, { type: "REVIEW_REQUESTED", candidateHash: "c-1", scopes: ["ACADEMIC", "ASSESSMENT"] }));

describe("live and audit binding", () => {
  it("records live, then an audit of exactly that revision", () => {
    expect(stage(build(live(), auditEv()))).toBe("AUDITED");
  });
  it("rejects an audit of a revision that is not live (incorrect legacy revision)", () => {
    rejects(() => build(live(), auditEv("h-other")), "STALE_AUDIT");
  });
  it("marks the audit stale when the live revision changes after it", () => {
    const ledger = build(live(), auditEv(), live("h-live-2", "rev-2"));
    expect(ledger.lessons.get(L)!.audit!.stale).toBe(true);
    expect(stage(ledger)).toBe("LIVE_UNAUDITED");
    expect(answerLedgerQuestions(ledger).deficient.staleAudits).toBe(1);
  });
});

describe("candidate generation is separate from review", () => {
  it("binds a candidate to the live legacy revision and refuses a stale binding", () => {
    rejects(() => build(live(), auditEv(), candidate("c-1", "h-old")), "STALE_LEGACY_BINDING");
  });
  it("invalidates the candidate binding when the legacy source changes after review began", () => {
    const ledger = appendEvents(base(), [live("h-live-2", "rev-2")]);
    expect(ledger.lessons.get(L)!.candidate!.legacyBindingStale).toBe(true);
    rejects(() => appendEvents(ledger, [review(humanReviewer, "ACADEMIC")]), "STALE_LEGACY_BINDING");
  });
  it("waits in AWAITING_INDEPENDENT_REVIEW after a review request", () => {
    expect(stage(base())).toBe("AWAITING_INDEPENDENT_REVIEW");
    expect(answerLedgerQuestions(base()).awaitingIndependentReview).toBe(1);
  });
  it("refuses candidate work on a held lesson", () => {
    rejects(() => build(live(), auditEv(), ev(tool, { type: "HOLD_PLACED", reasons: ["NO_MOE_SOURCE_FOR_SUBJECT"] }), candidate()), "LESSON_ON_HOLD");
  });
  it("only a human governance owner resolves a hold, with a decision reference", () => {
    const held = build(live(), auditEv(), ev(tool, { type: "HOLD_PLACED", reasons: ["NO_MOE_SOURCE_FOR_SUBJECT"] }));
    rejects(() => appendEvents(held, [ev(tool, { type: "HOLD_RESOLVED", decisionRef: "x", resolution: "y" })]), "ROLE_NOT_PERMITTED");
    rejects(() => appendEvents(held, [ev(owner, { type: "HOLD_RESOLVED", decisionRef: " ", resolution: "y" })]), "DECISION_REFERENCE_REQUIRED");
    expect(stage(appendEvents(held, [ev(owner, { type: "HOLD_RESOLVED", decisionRef: "DEC-CS-SCOPE-1", resolution: "adopt as LiberiaLearn enrichment" })]))).toBe("AUDITED");
  });
});

describe("independent review", () => {
  it("prohibits self-review", () => {
    const selfReviewer: LedgerActor = { ...authorAi, role: "AI_REVIEWER" };
    rejects(() => appendEvents(base(), [review(selfReviewer, "ACADEMIC")]), "SELF_REVIEW_PROHIBITED");
  });
  it("records AI review as advisory: never independent acceptance, even from another model family", () => {
    const ledger = appendEvents(base(), [review(sameFamilyAi, "ACADEMIC"), review(otherFamilyAi, "ASSESSMENT")]);
    const reviews = ledger.lessons.get(L)!.reviews;
    expect(reviews[0]).toMatchObject({ independent: false, counts: false });
    expect(reviews[0].reasons).toContain("SAME_MODEL_FAMILY_AS_AUTHOR");
    expect(reviews[1]).toMatchObject({ independent: true, counts: false });
    expect(stage(ledger)).toBe("AWAITING_INDEPENDENT_REVIEW");
  });
  it("rejects a review of a stale candidate hash", () => {
    rejects(() => appendEvents(base(), [review(humanReviewer, "ACADEMIC", "ACCEPT", "c-old")]), "STALE_CANDIDATE_HASH");
  });
  it("reaches REVIEW_ACCEPTED only with human acceptance of academic and assessment scopes", () => {
    const one = appendEvents(base(), [review(humanReviewer, "ACADEMIC")]);
    expect(stage(one)).toBe("AWAITING_INDEPENDENT_REVIEW");
    expect(stage(appendEvents(one, [review(assessmentReviewer, "ASSESSMENT")]))).toBe("REVIEW_ACCEPTED");
  });
  it("a new candidate version discards earlier reviews", () => {
    const accepted = appendEvents(base(), [review(humanReviewer, "ACADEMIC"), review(assessmentReviewer, "ASSESSMENT")]);
    const revised = appendEvents(accepted, [candidate("c-2")]);
    expect(revised.lessons.get(L)!.reviews).toHaveLength(0);
    expect(stage(revised)).toBe("CANDIDATE_READY");
  });
  it("shows CHANGES_REQUESTED when a counting reviewer asks for changes", () => {
    expect(stage(appendEvents(base(), [review(humanReviewer, "ACADEMIC", "CHANGES_REQUESTED")]))).toBe("CHANGES_REQUESTED");
  });
});

describe("release authority", () => {
  const accepted = () => appendEvents(base(), [review(humanReviewer, "ACADEMIC"), review(assessmentReviewer, "ASSESSMENT")]);
  it("refuses release authorization without independent acceptance", () => {
    rejects(() => appendEvents(base(), [authorize()]), "INDEPENDENT_ACCEPTANCE_MISSING");
  });
  it("refuses authorization by a reviewer role, by MergeOps, or by the author", () => {
    rejects(() => appendEvents(accepted(), [authorize(humanReviewer)]), "ROLE_NOT_PERMITTED");
    rejects(() => appendEvents(accepted(), [authorize(mergeops)]), "ROLE_NOT_PERMITTED");
    const humanAuthor: LedgerActor = { kind: "HUMAN", id: authorAi.id, role: "CURRICULUM_AUTHORITY" };
    rejects(() => appendEvents(accepted(), [authorize(humanAuthor)]), "AUTHOR_CANNOT_AUTHORIZE_RELEASE");
  });
  it("requires historical pins to be preserved and a legacy mapping plan", () => {
    rejects(() => appendEvents(accepted(), [ev(authority, { type: "RELEASE_AUTHORIZED", candidateHash: "c-1", legacyMappingPlanDigest: "", historyPolicy: "PRESERVE_HISTORICAL_PINS", futureAssignments: "TEACHER_OPT_IN" })]), "LEGACY_MAPPING_PLAN_REQUIRED");
  });
  it("records a release only under an authorization for the same hash", () => {
    rejects(() => appendEvents(accepted(), [ev(release, { type: "RELEASED", candidateHash: "c-1", releaseRef: "rel-1", releasedRevisionId: "rev-9", releasedContentHash: "h-9" })]), "RELEASE_NOT_AUTHORIZED");
    const released = appendEvents(accepted(), [authorize(), ev(release, { type: "RELEASED", candidateHash: "c-1", releaseRef: "rel-1", releasedRevisionId: "rev-9", releasedContentHash: "h-9" })]);
    expect(stage(released)).toBe("RELEASED");
  });
  it("does not let the release system be impersonated by a human or by MergeOps", () => {
    const authorized = appendEvents(accepted(), [authorize()]);
    rejects(() => appendEvents(authorized, [ev(mergeops, { type: "RELEASED", candidateHash: "c-1", releaseRef: "r", releasedRevisionId: "x", releasedContentHash: "y" })]), "ROLE_NOT_PERMITTED");
    rejects(() => appendEvents(authorized, [ev({ kind: "HUMAN", id: "h", role: "RELEASE_SYSTEM" }, { type: "RELEASED", candidateHash: "c-1", releaseRef: "r", releasedRevisionId: "x", releasedContentHash: "y" })]), "ACTOR_KIND_NOT_PERMITTED");
  });
});

describe("MergeOps observes only", () => {
  it("may report live state and staleness but may not review, confirm tracks, hold-resolve or publish", () => {
    const ledger = appendEvents(base(), [ev(mergeops, { type: "STALE_DETECTED", reason: "manifest older than live revision" })]);
    expect(ledger.events).toHaveLength(5);
    rejects(() => appendEvents(base(), [ev({ ...mergeops }, { type: "REVIEW_RECORDED", candidateHash: "c-1", scope: "ACADEMIC", decision: "ACCEPT", reportDigest: "r" })]), "ROLE_NOT_PERMITTED");
    rejects(() => appendEvents(base(), [ev(mergeops, { type: "TRACK_CONFIRMED", track: "A_TARGETED_REPAIR", rationale: "x" })]), "ROLE_NOT_PERMITTED");
    rejects(() => appendEvents(base(), [ev(mergeops, { type: "CANDIDATE_REGISTERED", candidateId: "x", candidateVersion: "1", candidateHash: "c", manifestHash: "m", legacyRevisionId: "rev-1", legacyContentHash: "h-live-1", authors: [mergeops] })]), "ROLE_NOT_PERMITTED");
  });
});

describe("learning outcomes", () => {
  const released = () => appendEvents(base(), [review(humanReviewer, "ACADEMIC"), review(assessmentReviewer, "ASSESSMENT"), authorize(), ev(release, { type: "RELEASED", candidateHash: "c-1", releaseRef: "rel-1", releasedRevisionId: "rev-9", releasedContentHash: "h-9" })]);
  const wave = (w: "BASELINE" | "IMMEDIATE_POST" | "DELAYED_RETENTION" | "TRANSFER" | "EXTERNAL_ANCHOR", extra: object = {}) =>
    ev(measurement, { type: "OUTCOME_EVIDENCE_RECORDED", contentHash: "h-9", instrumentRef: "inst-1", evidence: { kind: "MEASURED", wave: w, matchedLearners: 60, unassisted: true, blindScored: true, delayDays: 21, comparison: "COMPARISON_GROUP", effect: { estimate: 0.4, ciLower95: 0.1 }, ...extra } });
  it("refuses outcome evidence before release or for content learners did not receive", () => {
    rejects(() => appendEvents(base(), [wave("BASELINE")]), "OUTCOME_REQUIRES_RELEASED_CONTENT");
    rejects(() => appendEvents(released(), [ev(measurement, { type: "OUTCOME_EVIDENCE_RECORDED", contentHash: "h-live-1", instrumentRef: "i", evidence: { kind: "COMPLETED" } })]), "OUTCOME_NOT_BOUND_TO_RELEASED_CONTENT");
  });
  it("release and completion alone are delivery evidence, not learning", () => {
    const ledger = appendEvents(released(), [ev(measurement, { type: "OUTCOME_EVIDENCE_RECORDED", contentHash: "h-9", instrumentRef: "logs", evidence: { kind: "COMPLETED" } })]);
    expect(ledger.lessons.get(L)!.outcome.status).toBe("DELIVERED");
    expect(answerLedgerQuestions(ledger).demonstratedLearningSuccess).toBe(0);
  });
  it("demonstrates success only with retained, transferred and independently comparable gains", () => {
    const partial = appendEvents(released(), [wave("BASELINE"), wave("IMMEDIATE_POST"), wave("DELAYED_RETENTION")]);
    expect(partial.lessons.get(L)!.outcome.status).toBe("LEARNING_RETAINED");
    const full = appendEvents(partial, [wave("TRANSFER"), wave("EXTERNAL_ANCHOR")]);
    expect(full.lessons.get(L)!.outcome.status).toBe("LEARNING_SUCCESS_DEMONSTRATED");
    expect(answerLedgerQuestions(full).demonstratedLearningSuccess).toBe(1);
  });
  it("excludes assisted measurement", () => {
    const ledger = appendEvents(released(), [wave("BASELINE"), wave("IMMEDIATE_POST", { unassisted: false })]);
    expect(ledger.lessons.get(L)!.outcome.status).toBe("DELIVERED");
  });
});

describe("tamper evidence", () => {
  it("replays a valid chain", () => {
    const ledger = base();
    expect(replayLedger(ledger.events).head).toBe(ledger.head);
  });
  it("detects an edited event", () => {
    const events = [...base().events];
    events[1] = { ...events[1], body: { ...(events[1].body as object), mechanicalOutcome: "PASS_MECHANICAL_CHECKS" } as never };
    rejects(() => replayLedger(events), "EVENT_TAMPERED");
  });
  it("detects a re-signed edit through the chain, and deletion or reordering", () => {
    const events = [...base().events];
    const { hash: _hash, ...unsigned } = events[1];
    const forged = { ...unsigned, body: { ...(unsigned.body as object), findings: {} } as never };
    events[1] = { ...forged, hash: hashEvent(forged) };
    rejects(() => replayLedger(events), "CHAIN_BROKEN");
    rejects(() => replayLedger([base().events[0], base().events[2]]), "SEQUENCE_BROKEN");
    rejects(() => replayLedger([base().events[1], base().events[0]]), "SEQUENCE_BROKEN");
  });
  it("re-applies authority rules on replay, so a forged but well-chained approval still fails", () => {
    const valid = base();
    const forgedBody = { type: "RELEASE_AUTHORIZED", candidateHash: "c-1", legacyMappingPlanDigest: "p", historyPolicy: "PRESERVE_HISTORICAL_PINS", futureAssignments: "TEACHER_OPT_IN" } as const;
    const unsigned = { ledgerVersion: valid.events[0].ledgerVersion, seq: valid.events.length + 1, at, contentId: L, actor: authority, body: forgedBody, prevHash: valid.head };
    rejects(() => replayLedger([...valid.events, { ...unsigned, hash: hashEvent(unsigned) }]), "INDEPENDENT_ACCEPTANCE_MISSING");
  });
});
