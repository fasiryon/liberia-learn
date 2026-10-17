/**
 * Library Modernization Ledger V1: the authoritative record of every lesson's modernization state.
 *
 * At any moment the ledger answers, per lesson and in aggregate:
 *   What is live?                     the exact live revision and hash last observed (read-only extraction)
 *   What is deficient?                the audit of that exact revision, and whether the audit is stale
 *   What is being rebuilt?            scheduled / in-progress / candidate work, bound to the legacy revision it replaces
 *   What awaits independent review?   the exact candidate hash under review and who may not review it
 *   What is approved?                 human acceptance of that hash, release authorization and recorded release
 *   What has demonstrated learning?   classifyLessonOutcome over measured evidence bound to the released content
 *
 * Design:
 *   - Append-only JSONL. Each event carries the previous event's hash; replay verifies the chain, so any
 *     edit, deletion or reordering is detected.
 *   - Every event is checked by `applyEvent` against the state built from all earlier events. The checks
 *     enforce authority: who may record what, self-review, stale hashes, holds, and the separation of
 *     candidate generation, review, release authorization, release and outcome measurement.
 *   - The ledger records decisions; it does not make them. Nothing here publishes a lesson, writes learner
 *     state, scores, or admits mastery evidence. RELEASED is a record of a release performed elsewhere
 *     under an authorization already in the ledger.
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { classifyLessonOutcome, type LessonOutcomeClassification, type OutcomeEvidence } from "@/lib/curriculum/excellence/outcomeClaims";
import type { ModernizationTrack } from "./classify";
import type { ReviewOutcome } from "./legacyAudit";

export const MODERNIZATION_LEDGER_VERSION = "liberialearn-modernization-ledger/1.0.0" as const;
export const LEDGER_GENESIS_HASH = "0".repeat(64);

// ─── Actors and authority ───────────────────────────────────────────────────

export type ActorKind = "AUTOMATED" | "AI_AGENT" | "HUMAN";
export type ActorRole =
  | "INVENTORY_TOOL"        // read-only extraction, audit and classification tooling
  | "MERGEOPS"              // engineering automation: observes and reports only
  | "CANDIDATE_AUTHOR"      // AI agent or human who authors a candidate
  | "AI_REVIEWER"           // advisory AI review; never acceptance
  | "CURRICULUM_REVIEWER"   // qualified human subject/assessment/localization reviewer
  | "GOVERNANCE_OWNER"      // human curriculum owner: holds, scope decisions, track confirmation
  | "CURRICULUM_AUTHORITY"  // human who authorizes release of an accepted candidate
  | "RELEASE_SYSTEM"        // the governed release mechanism recording a release it performed
  | "MEASUREMENT_LEAD";     // human who records pilot measurement evidence

export type LedgerActor = Readonly<{ kind: ActorKind; id: string; role: ActorRole; modelFamily?: string }>;

const ROLE_KINDS: Readonly<Record<ActorRole, readonly ActorKind[]>> = Object.freeze({
  INVENTORY_TOOL: ["AUTOMATED"],
  MERGEOPS: ["AUTOMATED"],
  CANDIDATE_AUTHOR: ["AI_AGENT", "HUMAN"],
  AI_REVIEWER: ["AI_AGENT"],
  CURRICULUM_REVIEWER: ["HUMAN"],
  GOVERNANCE_OWNER: ["HUMAN"],
  CURRICULUM_AUTHORITY: ["HUMAN"],
  RELEASE_SYSTEM: ["AUTOMATED"],
  MEASUREMENT_LEAD: ["HUMAN"],
});

// ─── Events ─────────────────────────────────────────────────────────────────

export type ReviewScope = "ACADEMIC" | "ASSESSMENT" | "ACCESSIBILITY" | "LOCALIZATION";
/** Human acceptance of these scopes on one exact candidate hash is required before release can be authorized. */
export const REQUIRED_ACCEPTANCE_SCOPES: readonly ReviewScope[] = Object.freeze(["ACADEMIC", "ASSESSMENT"]);

export type LedgerEventBody =
  | { type: "LIVE_OBSERVED"; revisionId: string; contentHash: string; status: string; lifecycleState: string | null; extractSha256: string }
  | { type: "AUDIT_RECORDED"; revisionId: string; contentHash: string; auditVersion: string; auditDigest: string; mechanicalOutcome: ReviewOutcome; reviewOutcome: ReviewOutcome; findings: Readonly<Record<string, number>> }
  | { type: "TRACK_PROPOSED"; track: ModernizationTrack; trackAfterHold: ModernizationTrack | null; auditDigest: string; reasons: readonly string[] }
  | { type: "TRACK_CONFIRMED"; track: ModernizationTrack; rationale: string }
  | { type: "HOLD_PLACED"; reasons: readonly string[] }
  | { type: "HOLD_RESOLVED"; decisionRef: string; resolution: string }
  | { type: "WAVE_SCHEDULED"; wave: number; rank: number; planDigest: string }
  | { type: "WORK_STARTED"; pipelineRunId: string; legacyRevisionId: string; legacyContentHash: string }
  | { type: "CANDIDATE_REGISTERED"; candidateId: string; candidateVersion: string; candidateHash: string; manifestHash: string; legacyRevisionId: string; legacyContentHash: string; authors: readonly LedgerActor[] }
  | { type: "REVIEW_REQUESTED"; candidateHash: string; scopes: readonly ReviewScope[] }
  | { type: "REVIEW_RECORDED"; candidateHash: string; scope: ReviewScope; decision: "ACCEPT" | "CHANGES_REQUESTED" | "REJECT"; reportDigest: string; qualification?: string }
  | { type: "RELEASE_AUTHORIZED"; candidateHash: string; legacyMappingPlanDigest: string; historyPolicy: "PRESERVE_HISTORICAL_PINS"; futureAssignments: "NEW_ASSIGNMENTS_USE_RELEASED" | "TEACHER_OPT_IN" }
  | { type: "RELEASED"; candidateHash: string; releaseRef: string; releasedRevisionId: string; releasedContentHash: string }
  | { type: "OUTCOME_EVIDENCE_RECORDED"; contentHash: string; evidence: OutcomeEvidence; instrumentRef: string }
  | { type: "STALE_DETECTED"; reason: string };

export type LedgerEventType = LedgerEventBody["type"];

export type LedgerEvent = Readonly<{
  ledgerVersion: typeof MODERNIZATION_LEDGER_VERSION;
  seq: number;
  at: string;
  contentId: string;
  actor: LedgerActor;
  body: LedgerEventBody;
  prevHash: string;
  hash: string;
}>;

/** Which roles may record each event type. Everything else is refused. */
const EVENT_ROLES: Readonly<Record<LedgerEventType, readonly ActorRole[]>> = Object.freeze({
  LIVE_OBSERVED: ["INVENTORY_TOOL", "MERGEOPS"],
  AUDIT_RECORDED: ["INVENTORY_TOOL"],
  TRACK_PROPOSED: ["INVENTORY_TOOL"],
  TRACK_CONFIRMED: ["GOVERNANCE_OWNER", "CURRICULUM_REVIEWER"],
  HOLD_PLACED: ["INVENTORY_TOOL", "GOVERNANCE_OWNER"],
  HOLD_RESOLVED: ["GOVERNANCE_OWNER"],
  WAVE_SCHEDULED: ["INVENTORY_TOOL", "GOVERNANCE_OWNER"],
  WORK_STARTED: ["CANDIDATE_AUTHOR"],
  CANDIDATE_REGISTERED: ["CANDIDATE_AUTHOR"],
  REVIEW_REQUESTED: ["CANDIDATE_AUTHOR", "GOVERNANCE_OWNER"],
  REVIEW_RECORDED: ["CURRICULUM_REVIEWER", "AI_REVIEWER"],
  RELEASE_AUTHORIZED: ["CURRICULUM_AUTHORITY"],
  RELEASED: ["RELEASE_SYSTEM"],
  OUTCOME_EVIDENCE_RECORDED: ["MEASUREMENT_LEAD"],
  STALE_DETECTED: ["INVENTORY_TOOL", "MERGEOPS"],
});

// ─── State ──────────────────────────────────────────────────────────────────

export const LEDGER_STAGES = [
  "NOT_OBSERVED", "LIVE_UNAUDITED", "ON_HOLD", "AUDITED", "SCHEDULED", "IN_PROGRESS", "CANDIDATE_READY",
  "AWAITING_INDEPENDENT_REVIEW", "CHANGES_REQUESTED", "REVIEW_ACCEPTED", "RELEASE_AUTHORIZED", "RELEASED",
] as const;
export type LedgerStage = (typeof LEDGER_STAGES)[number];

export type ReviewRecord = Readonly<{ seq: number; reviewer: LedgerActor; scope: ReviewScope; decision: "ACCEPT" | "CHANGES_REQUESTED" | "REJECT"; independent: boolean; counts: boolean; reasons: readonly string[] }>;

export type LessonLedgerState = Readonly<{
  contentId: string;
  stage: LedgerStage;
  live: Readonly<{ revisionId: string; contentHash: string; status: string; lifecycleState: string | null; observedSeq: number }> | null;
  audit: Readonly<{ revisionId: string; contentHash: string; auditDigest: string; mechanicalOutcome: ReviewOutcome; reviewOutcome: ReviewOutcome; findings: Readonly<Record<string, number>>; stale: boolean }> | null;
  track: Readonly<{ proposed: ModernizationTrack | null; trackAfterHold: ModernizationTrack | null; confirmed: ModernizationTrack | null; confirmedBy: string | null }>;
  hold: Readonly<{ active: boolean; reasons: readonly string[]; resolvedBy: string | null }>;
  wave: Readonly<{ wave: number; rank: number }> | null;
  work: Readonly<{ pipelineRunId: string; legacyRevisionId: string; legacyContentHash: string }> | null;
  candidate: Readonly<{ candidateId: string; candidateVersion: string; candidateHash: string; manifestHash: string; legacyRevisionId: string; legacyContentHash: string; authors: readonly LedgerActor[]; legacyBindingStale: boolean }> | null;
  reviews: readonly ReviewRecord[];
  reviewRequested: boolean;
  releaseAuthorization: Readonly<{ candidateHash: string; by: string; legacyMappingPlanDigest: string; futureAssignments: string }> | null;
  release: Readonly<{ candidateHash: string; releaseRef: string; releasedRevisionId: string; releasedContentHash: string }> | null;
  outcomeEvidence: readonly Readonly<{ contentHash: string; evidence: OutcomeEvidence; instrumentRef: string }>[];
  outcome: LessonOutcomeClassification;
}>;

export class LedgerRejection extends Error {
  constructor(public readonly code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "LedgerRejection";
  }
}

const emptyOutcome = classifyLessonOutcome([]);

function initialState(contentId: string): LessonLedgerState {
  return {
    contentId, stage: "NOT_OBSERVED", live: null, audit: null,
    track: { proposed: null, trackAfterHold: null, confirmed: null, confirmedBy: null },
    hold: { active: false, reasons: [], resolvedBy: null }, wave: null, work: null, candidate: null, reviews: [], reviewRequested: false,
    releaseAuthorization: null, release: null, outcomeEvidence: [], outcome: emptyOutcome,
  };
}

/** AI reviewers of the same model family as an AI author are correlated with it and are never independent. */
function reviewIndependence(reviewer: LedgerActor, authors: readonly LedgerActor[]): { independent: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (authors.some((author) => author.id === reviewer.id)) reasons.push("SELF_REVIEW");
  if (reviewer.kind === "AI_AGENT" && authors.some((author) => author.kind === "AI_AGENT" && author.modelFamily && author.modelFamily === reviewer.modelFamily)) reasons.push("SAME_MODEL_FAMILY_AS_AUTHOR");
  return { independent: reasons.length === 0, reasons };
}

function acceptedScopes(reviews: readonly ReviewRecord[]): Set<ReviewScope> {
  // The latest counting human decision per scope wins.
  const latest = new Map<ReviewScope, ReviewRecord>();
  for (const review of reviews) if (review.counts) latest.set(review.scope, review);
  return new Set(Array.from(latest.values()).filter((review) => review.decision === "ACCEPT").map((review) => review.scope));
}

function deriveStage(state: Omit<LessonLedgerState, "stage">): LedgerStage {
  if (!state.live) return "NOT_OBSERVED";
  if (state.release) return "RELEASED";
  if (state.hold.active) return "ON_HOLD";
  if (state.releaseAuthorization) return "RELEASE_AUTHORIZED";
  if (state.candidate && !state.candidate.legacyBindingStale) {
    const counting = state.reviews.filter((review) => review.counts);
    const latest = new Map<ReviewScope, ReviewRecord>();
    for (const review of counting) latest.set(review.scope, review);
    if (Array.from(latest.values()).some((review) => review.decision !== "ACCEPT")) return "CHANGES_REQUESTED";
    const accepted = acceptedScopes(state.reviews);
    if (REQUIRED_ACCEPTANCE_SCOPES.every((scope) => accepted.has(scope))) return "REVIEW_ACCEPTED";
    return state.reviewRequested ? "AWAITING_INDEPENDENT_REVIEW" : "CANDIDATE_READY";
  }
  if (state.work && state.work.legacyContentHash === state.live.contentHash) return "IN_PROGRESS";
  if (state.wave) return "SCHEDULED";
  if (state.audit && !state.audit.stale) return "AUDITED";
  return "LIVE_UNAUDITED";
}

type MutableState = { -readonly [K in keyof Omit<LessonLedgerState, "stage">]: LessonLedgerState[K] };

/**
 * Applies one event to a lesson's state, refusing anything the actor may not do or that contradicts the
 * state (stale hashes, holds, self-review, missing acceptance). Pure: returns a new state.
 */
export function applyEvent(previous: LessonLedgerState, event: Pick<LedgerEvent, "seq" | "actor" | "body" | "contentId">): LessonLedgerState {
  const { actor, body } = event;
  if (!EVENT_ROLES[body.type].includes(actor.role)) throw new LedgerRejection("ROLE_NOT_PERMITTED", `${actor.role} cannot record ${body.type}`);
  if (!ROLE_KINDS[actor.role].includes(actor.kind)) throw new LedgerRejection("ACTOR_KIND_NOT_PERMITTED", `${actor.kind} cannot act as ${actor.role}`);
  if (!actor.id) throw new LedgerRejection("ACTOR_ID_REQUIRED");
  const { stage: _previousStage, ...rest } = previous;
  const s: MutableState = { ...rest };
  const requireLive = () => { if (!s.live) throw new LedgerRejection("LIVE_REVISION_UNKNOWN"); return s.live; };
  const requireCandidate = (hash: string) => {
    if (!s.candidate) throw new LedgerRejection("NO_CANDIDATE");
    if (s.candidate.candidateHash !== hash) throw new LedgerRejection("STALE_CANDIDATE_HASH", `${hash} is not the current candidate ${s.candidate.candidateHash}`);
    if (s.candidate.legacyBindingStale) throw new LedgerRejection("STALE_LEGACY_BINDING", "the live legacy revision changed after the candidate was built");
    return s.candidate;
  };

  switch (body.type) {
    case "LIVE_OBSERVED": {
      const changed = !!s.live && (s.live.revisionId !== body.revisionId || s.live.contentHash !== body.contentHash);
      s.live = { revisionId: body.revisionId, contentHash: body.contentHash, status: body.status, lifecycleState: body.lifecycleState, observedSeq: event.seq };
      if (s.audit && (s.audit.revisionId !== body.revisionId || s.audit.contentHash !== body.contentHash)) s.audit = { ...s.audit, stale: true };
      if (changed && s.candidate && !s.release) s.candidate = { ...s.candidate, legacyBindingStale: s.candidate.legacyContentHash !== body.contentHash };
      break;
    }
    case "AUDIT_RECORDED": {
      const live = requireLive();
      if (live.revisionId !== body.revisionId || live.contentHash !== body.contentHash) throw new LedgerRejection("STALE_AUDIT", "audit does not match the live revision");
      s.audit = { revisionId: body.revisionId, contentHash: body.contentHash, auditDigest: body.auditDigest, mechanicalOutcome: body.mechanicalOutcome, reviewOutcome: body.reviewOutcome, findings: body.findings, stale: false };
      break;
    }
    case "TRACK_PROPOSED": {
      if (!s.audit || s.audit.stale || s.audit.auditDigest !== body.auditDigest) throw new LedgerRejection("TRACK_WITHOUT_CURRENT_AUDIT");
      s.track = { ...s.track, proposed: body.track, trackAfterHold: body.trackAfterHold };
      break;
    }
    case "TRACK_CONFIRMED":
      if (!s.track.proposed) throw new LedgerRejection("NO_PROPOSED_TRACK");
      if (!body.rationale.trim()) throw new LedgerRejection("RATIONALE_REQUIRED");
      s.track = { ...s.track, confirmed: body.track, confirmedBy: actor.id };
      break;
    case "HOLD_PLACED":
      if (!body.reasons.length) throw new LedgerRejection("HOLD_REASON_REQUIRED");
      s.hold = { active: true, reasons: Array.from(new Set([...(s.hold.active ? s.hold.reasons : []), ...body.reasons])).sort(), resolvedBy: null };
      break;
    case "HOLD_RESOLVED":
      if (!s.hold.active) throw new LedgerRejection("NO_ACTIVE_HOLD");
      if (!body.decisionRef.trim()) throw new LedgerRejection("DECISION_REFERENCE_REQUIRED");
      s.hold = { active: false, reasons: s.hold.reasons, resolvedBy: actor.id };
      break;
    case "WAVE_SCHEDULED":
      if (s.hold.active) throw new LedgerRejection("LESSON_ON_HOLD");
      s.wave = { wave: body.wave, rank: body.rank };
      break;
    case "WORK_STARTED": {
      const live = requireLive();
      if (s.hold.active) throw new LedgerRejection("LESSON_ON_HOLD");
      if (body.legacyRevisionId !== live.revisionId || body.legacyContentHash !== live.contentHash) throw new LedgerRejection("STALE_LEGACY_BINDING", "work must start from the live legacy revision");
      s.work = { pipelineRunId: body.pipelineRunId, legacyRevisionId: body.legacyRevisionId, legacyContentHash: body.legacyContentHash };
      break;
    }
    case "CANDIDATE_REGISTERED": {
      const live = requireLive();
      if (s.hold.active) throw new LedgerRejection("LESSON_ON_HOLD");
      if (body.legacyRevisionId !== live.revisionId || body.legacyContentHash !== live.contentHash) throw new LedgerRejection("STALE_LEGACY_BINDING", "candidate must be bound to the live legacy revision");
      if (!body.authors.some((author) => author.id === actor.id)) throw new LedgerRejection("REGISTRANT_NOT_AUTHOR");
      if (s.releaseAuthorization && !s.release) throw new LedgerRejection("CANDIDATE_LOCKED_BY_RELEASE_AUTHORIZATION");
      // A new candidate version supersedes the old one: earlier reviews no longer apply.
      s.candidate = { candidateId: body.candidateId, candidateVersion: body.candidateVersion, candidateHash: body.candidateHash, manifestHash: body.manifestHash, legacyRevisionId: body.legacyRevisionId, legacyContentHash: body.legacyContentHash, authors: body.authors, legacyBindingStale: false };
      s.reviews = [];
      s.reviewRequested = false;
      s.releaseAuthorization = null;
      break;
    }
    case "REVIEW_REQUESTED":
      requireCandidate(body.candidateHash);
      if (!body.scopes.length) throw new LedgerRejection("REVIEW_SCOPE_REQUIRED");
      s.reviewRequested = true;
      break;
    case "REVIEW_RECORDED": {
      const candidate = requireCandidate(body.candidateHash);
      const { independent, reasons } = reviewIndependence(actor, candidate.authors);
      if (reasons.includes("SELF_REVIEW")) throw new LedgerRejection("SELF_REVIEW_PROHIBITED", `${actor.id} authored this candidate`);
      if (!body.reportDigest) throw new LedgerRejection("REVIEW_REPORT_REQUIRED");
      // AI review is advisory evidence: recorded, never counted toward acceptance.
      const counts = actor.kind === "HUMAN" && independent;
      s.reviews = [...s.reviews, { seq: event.seq, reviewer: actor, scope: body.scope, decision: body.decision, independent, counts, reasons: actor.kind === "HUMAN" ? reasons : [...reasons, "AI_REVIEW_ADVISORY"] }];
      break;
    }
    case "RELEASE_AUTHORIZED": {
      const candidate = requireCandidate(body.candidateHash);
      if (s.hold.active) throw new LedgerRejection("LESSON_ON_HOLD");
      if (candidate.authors.some((author) => author.id === actor.id)) throw new LedgerRejection("AUTHOR_CANNOT_AUTHORIZE_RELEASE");
      const accepted = acceptedScopes(s.reviews);
      const missing = REQUIRED_ACCEPTANCE_SCOPES.filter((scope) => !accepted.has(scope));
      if (missing.length) throw new LedgerRejection("INDEPENDENT_ACCEPTANCE_MISSING", missing.join(","));
      if (!body.legacyMappingPlanDigest) throw new LedgerRejection("LEGACY_MAPPING_PLAN_REQUIRED");
      if (body.historyPolicy !== "PRESERVE_HISTORICAL_PINS") throw new LedgerRejection("HISTORY_MUST_BE_PRESERVED");
      s.releaseAuthorization = { candidateHash: body.candidateHash, by: actor.id, legacyMappingPlanDigest: body.legacyMappingPlanDigest, futureAssignments: body.futureAssignments };
      break;
    }
    case "RELEASED":
      if (!s.releaseAuthorization || s.releaseAuthorization.candidateHash !== body.candidateHash) throw new LedgerRejection("RELEASE_NOT_AUTHORIZED");
      if (!body.releaseRef) throw new LedgerRejection("RELEASE_REFERENCE_REQUIRED");
      s.release = { candidateHash: body.candidateHash, releaseRef: body.releaseRef, releasedRevisionId: body.releasedRevisionId, releasedContentHash: body.releasedContentHash };
      break;
    case "OUTCOME_EVIDENCE_RECORDED": {
      // Learning evidence must be about content learners actually received: the released revision.
      if (!s.release) throw new LedgerRejection("OUTCOME_REQUIRES_RELEASED_CONTENT");
      if (body.contentHash !== s.release.releasedContentHash) throw new LedgerRejection("OUTCOME_NOT_BOUND_TO_RELEASED_CONTENT");
      if (!body.instrumentRef) throw new LedgerRejection("INSTRUMENT_REFERENCE_REQUIRED");
      s.outcomeEvidence = [...s.outcomeEvidence, { contentHash: body.contentHash, evidence: body.evidence, instrumentRef: body.instrumentRef }];
      s.outcome = classifyLessonOutcome([{ kind: "PUBLISHED" }, ...s.outcomeEvidence.map((entry) => entry.evidence)]);
      break;
    }
    case "STALE_DETECTED":
      if (!body.reason) throw new LedgerRejection("REASON_REQUIRED");
      break;
    default:
      throw new LedgerRejection("UNKNOWN_EVENT");
  }
  return Object.freeze({ ...s, stage: deriveStage(s) });
}

// ─── Chain ──────────────────────────────────────────────────────────────────

export const hashEvent = (event: Omit<LedgerEvent, "hash">) => createHash("sha256").update(canonicalizeJson(event)).digest("hex");

export type Ledger = Readonly<{ events: readonly LedgerEvent[]; lessons: ReadonlyMap<string, LessonLedgerState>; head: string }>;

export function emptyLedger(): Ledger {
  return { events: [], lessons: new Map(), head: LEDGER_GENESIS_HASH };
}

/** Replays and verifies a ledger: chain integrity, sequence, and every authority rule. */
export function replayLedger(events: readonly LedgerEvent[]): Ledger {
  const lessons = new Map<string, LessonLedgerState>();
  let head = LEDGER_GENESIS_HASH;
  events.forEach((event, index) => {
    if (event.ledgerVersion !== MODERNIZATION_LEDGER_VERSION) throw new LedgerRejection("LEDGER_VERSION_MISMATCH", `seq ${event.seq}`);
    if (event.seq !== index + 1) throw new LedgerRejection("SEQUENCE_BROKEN", `expected ${index + 1}, got ${event.seq}`);
    if (event.prevHash !== head) throw new LedgerRejection("CHAIN_BROKEN", `seq ${event.seq}`);
    const { hash, ...unsigned } = event;
    if (hashEvent(unsigned) !== hash) throw new LedgerRejection("EVENT_TAMPERED", `seq ${event.seq}`);
    lessons.set(event.contentId, applyEvent(lessons.get(event.contentId) ?? initialState(event.contentId), event));
    head = hash;
  });
  return { events, lessons, head };
}

export type NewLedgerEvent = Readonly<{ at: string; contentId: string; actor: LedgerActor; body: LedgerEventBody }>;

/** Appends events after validating each against the current state. All-or-nothing. */
export function appendEvents(ledger: Ledger, additions: readonly NewLedgerEvent[]): Ledger {
  const lessons = new Map(ledger.lessons);
  const events = [...ledger.events];
  let head = ledger.head;
  for (const addition of additions) {
    const unsigned = { ledgerVersion: MODERNIZATION_LEDGER_VERSION, seq: events.length + 1, at: addition.at, contentId: addition.contentId, actor: addition.actor, body: addition.body, prevHash: head };
    lessons.set(addition.contentId, applyEvent(lessons.get(addition.contentId) ?? initialState(addition.contentId), unsigned));
    const event = Object.freeze({ ...unsigned, hash: hashEvent(unsigned) });
    events.push(event);
    head = event.hash;
  }
  return { events, lessons, head };
}

export function readLedgerFile(file: string): Ledger {
  if (!fs.existsSync(file)) return emptyLedger();
  const events = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as LedgerEvent);
  return replayLedger(events);
}

export function writeLedgerFile(file: string, ledger: Ledger): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, ledger.events.map((event) => JSON.stringify(event)).join("\n") + (ledger.events.length ? "\n" : ""));
}

// ─── Questions ──────────────────────────────────────────────────────────────

export type LedgerAnswers = Readonly<{
  lessons: number;
  live: Readonly<{ observed: number; byStatus: Readonly<Record<string, number>>; modernizedReleased: number }>;
  deficient: Readonly<{ audited: number; staleAudits: number; byReviewOutcome: Readonly<Record<string, number>>; byTrack: Readonly<Record<string, number>> }>;
  onHold: number;
  beingRebuilt: Readonly<{ scheduled: number; inProgress: number; candidateReady: number; changesRequested: number }>;
  awaitingIndependentReview: number;
  approved: Readonly<{ reviewAccepted: number; releaseAuthorized: number; released: number }>;
  outcomes: Readonly<Record<string, number>>;
  /** True only when a lesson's measured evidence meets LEARNING_SUCCESS_DEMONSTRATED. */
  demonstratedLearningSuccess: number;
  byStage: Readonly<Record<string, number>>;
}>;

const tally = (values: readonly string[]) => values.reduce<Record<string, number>>((out, value) => ({ ...out, [value]: (out[value] ?? 0) + 1 }), {});

export function answerLedgerQuestions(ledger: Ledger): LedgerAnswers {
  const states = Array.from(ledger.lessons.values());
  const stage = (value: LedgerStage) => states.filter((state) => state.stage === value).length;
  return Object.freeze({
    lessons: states.length,
    live: { observed: states.filter((s) => s.live).length, byStatus: tally(states.filter((s) => s.live).map((s) => s.live!.status)), modernizedReleased: stage("RELEASED") },
    deficient: {
      audited: states.filter((s) => s.audit).length,
      staleAudits: states.filter((s) => s.audit?.stale).length,
      byReviewOutcome: tally(states.filter((s) => s.audit && !s.audit.stale).map((s) => s.audit!.reviewOutcome)),
      byTrack: tally(states.map((s) => s.track.confirmed ?? s.track.proposed ?? "UNCLASSIFIED")),
    },
    onHold: stage("ON_HOLD"),
    beingRebuilt: { scheduled: stage("SCHEDULED"), inProgress: stage("IN_PROGRESS"), candidateReady: stage("CANDIDATE_READY"), changesRequested: stage("CHANGES_REQUESTED") },
    awaitingIndependentReview: stage("AWAITING_INDEPENDENT_REVIEW"),
    approved: { reviewAccepted: stage("REVIEW_ACCEPTED"), releaseAuthorized: stage("RELEASE_AUTHORIZED"), released: stage("RELEASED") },
    outcomes: tally(states.map((s) => s.outcome.status)),
    demonstratedLearningSuccess: states.filter((s) => s.outcome.maySayLessonSucceeded).length,
    byStage: tally(states.map((s) => s.stage)),
  });
}
