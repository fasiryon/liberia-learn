/**
 * Attempt-scoped assistance record — pure domain model (contract `assistance-ledger/1.0.0`).
 *
 * Independence of an assessment response is a server-attested fact derived from this record, never a
 * client claim. The server opens the record with the attempt, every assistance surface (tutor route,
 * hint and explanation projections, tool registry, teacher, offline replay) appends to it, and it is
 * sealed when the attempt is submitted.
 *
 * SECURITY SCOPE — read before relying on it:
 *   - This module is pure and in-memory. It has no storage and no routes. The hash chain detects
 *     accidental or partial edits, removals and reordering of a record it is handed, but anyone who
 *     can write the store can rebuild a consistent chain. Production assurance needs the M2 storage
 *     (append-only tables enforced by database triggers, the seal written in the same transaction as
 *     the attempt status, and least-privilege write access), which does not exist yet.
 *   - `ASSISTANCE_LEDGER_PRODUCTION_ENABLED` is a literal `false`; tests pin it.
 *
 * Invariants:
 *   - Scope: tenant, school, student, attempt, delivery session and release on every entry.
 *   - Server time: online events take the server's `recordedAt`; only an offline replay carries a
 *     device capture time, which must fall inside the attempt window.
 *   - Idempotency keys are derived on the server from the emitter's source reference. An exact replay
 *     is a no-op. A different payload under the same key is recorded as a CONFLICT entry (never an
 *     overwrite) and makes the attempt UNVERIFIED for integrity review.
 *   - INDEPENDENT requires the record to be chain-valid, opened, sealed, conflict-free, with every
 *     available channel instrumented and no assistance recorded. Recorded assistance yields ASSISTED.
 *     Everything else is UNVERIFIED.
 */
import { createHash } from "crypto";
import { canonicalizeJson } from "@/lib/curriculum/provenance/hash";
import { auditEvent, type AssessmentAuditEvent } from "./audit";
import { assertIsoTimestamp } from "./validator";

export const ASSISTANCE_LEDGER_VERSION = "assistance-ledger/1.0.0" as const;
export const ASSISTANCE_LEDGER_PRODUCTION_ENABLED = false as const;

export const ASSISTANCE_CHANNELS = ["TUTOR", "HINTS", "EXPLANATIONS", "ANSWERS", "TOOLS", "PEERS"] as const;
export type AssistanceChannel = (typeof ASSISTANCE_CHANNELS)[number];

export type AssistanceKind =
  | "TUTOR_TURN" | "HINT_REVEALED" | "EXPLANATION_SHOWN" | "WORKED_EXAMPLE_SHOWN"
  | "ANSWER_SHOWN" | "TOOL_USED" | "PROHIBITED_TOOL_USED" | "PEER_COLLABORATION_OBSERVED";

export const ASSISTANCE_KIND_CHANNEL: Readonly<Record<AssistanceKind, AssistanceChannel>> = Object.freeze({
  TUTOR_TURN: "TUTOR", HINT_REVEALED: "HINTS", EXPLANATION_SHOWN: "EXPLANATIONS", WORKED_EXAMPLE_SHOWN: "EXPLANATIONS",
  ANSWER_SHOWN: "ANSWERS", TOOL_USED: "TOOLS", PROHIBITED_TOOL_USED: "TOOLS", PEER_COLLABORATION_OBSERVED: "PEERS",
});

/**
 * Permitted-tool use (e.g. an allowed calculator) is neutral pending academic-policy decision P2.
 * Every other kind is assistance.
 */
const NEUTRAL_KINDS: readonly AssistanceKind[] = ["TOOL_USED"];

export type AssistanceLedgerScope = Readonly<{
  tenantId: string;
  schoolId: string;
  studentId: string;
  attemptId: string;
  sessionId: string;
  releaseId: string;
  releaseHash: string;
}>;

export type AssistanceProvenance =
  | Readonly<{ emitter: "SERVER_TUTOR_ROUTE"; tutorInteractionId: string }>
  | Readonly<{ emitter: "SERVER_HINT_PROJECTION"; hintId: string }>
  | Readonly<{ emitter: "SERVER_EXPLANATION_PROJECTION"; disclosurePhase: string }>
  | Readonly<{ emitter: "SERVER_TOOL_REGISTRY"; toolId: string; useId: string }>
  | Readonly<{ emitter: "TEACHER_RECORDED"; teacherUserId: string; recordingId: string; note: string }>
  | Readonly<{ emitter: "OFFLINE_DEVICE_REPLAY"; deviceId: string; clientSequence: number; syncBatchId: string; capturedAt: string }>;

export type AssistanceLedgerEvent =
  | Readonly<{ type: "OPENED"; availableChannels: readonly AssistanceChannel[]; instrumentedChannels: readonly AssistanceChannel[]; independentDelivery: boolean; offlineDeviceIds: readonly string[] }>
  | Readonly<{ type: "ASSISTANCE"; kind: AssistanceKind; itemId: string | null; provenance: AssistanceProvenance }>
  | Readonly<{ type: "SEALED"; reason: "SUBMITTED" | "CLOSED" | "ABANDONED" }>
  | Readonly<{ type: "CONFLICT"; idempotencyKey: string; priorEntryHash: string; rejectedPayloadDigest: string }>;

export type AssistanceLedgerEntry = Readonly<{
  ledgerVersion: typeof ASSISTANCE_LEDGER_VERSION;
  sequence: number;
  idempotencyKey: string;
  scope: AssistanceLedgerScope;
  event: AssistanceLedgerEvent;
  occurredAt: string;
  recordedAt: string;
  prevHash: string;
  entryHash: string;
}>;

export type AssistanceLedger = Readonly<{ version: typeof ASSISTANCE_LEDGER_VERSION; scope: AssistanceLedgerScope; entries: readonly AssistanceLedgerEntry[] }>;

const GENESIS = "0".repeat(64);
/** Beyond this the record is already UNVERIFIED; further conflicting deliveries are refused, not stored. */
export const MAX_ASSISTANCE_CONFLICTS = 16;
const CLOCK_SKEW_MS = 5 * 60_000;
const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const hashEntry = (entry: Omit<AssistanceLedgerEntry, "entryHash">) => sha256(canonicalizeJson({ domain: "liberialearn.assistance-ledger.v1", entry }));
/**
 * Semantic payload of an event. Transport-only fields (an offline sync batch id) are excluded, so a
 * normal re-batch of the same captured event is an idempotent replay, not a conflict.
 */
function payloadDigest(scope: AssistanceLedgerScope, event: AssistanceLedgerEvent): string {
  if (event.type === "ASSISTANCE" && event.provenance.emitter === "OFFLINE_DEVICE_REPLAY") {
    const { syncBatchId: _transport, ...provenance } = event.provenance;
    return sha256(canonicalizeJson({ scope, event: { ...event, provenance } }));
  }
  return sha256(canonicalizeJson({ scope, event }));
}

/** Kinds each emitter may record. A server surface cannot relabel what it produced (e.g. a hint as a neutral tool use). */
const EMITTER_KINDS: Readonly<Record<AssistanceProvenance["emitter"], readonly AssistanceKind[]>> = Object.freeze({
  SERVER_TUTOR_ROUTE: ["TUTOR_TURN"],
  SERVER_HINT_PROJECTION: ["HINT_REVEALED"],
  SERVER_EXPLANATION_PROJECTION: ["EXPLANATION_SHOWN", "WORKED_EXAMPLE_SHOWN", "ANSWER_SHOWN"],
  SERVER_TOOL_REGISTRY: ["TOOL_USED", "PROHIBITED_TOOL_USED"],
  TEACHER_RECORDED: ["TUTOR_TURN", "HINT_REVEALED", "EXPLANATION_SHOWN", "WORKED_EXAMPLE_SHOWN", "ANSWER_SHOWN", "TOOL_USED", "PROHIBITED_TOOL_USED", "PEER_COLLABORATION_OBSERVED"],
  OFFLINE_DEVICE_REPLAY: ["TUTOR_TURN", "HINT_REVEALED", "EXPLANATION_SHOWN", "WORKED_EXAMPLE_SHOWN", "ANSWER_SHOWN", "TOOL_USED", "PROHIBITED_TOOL_USED", "PEER_COLLABORATION_OBSERVED"],
});

function sourceRef(event: Extract<AssistanceLedgerEvent, { type: "ASSISTANCE" }>): string {
  const p = event.provenance;
  switch (p.emitter) {
    case "SERVER_TUTOR_ROUTE": return p.tutorInteractionId;
    case "SERVER_HINT_PROJECTION": return `${event.itemId ?? "*"}:${p.hintId}`;
    case "SERVER_EXPLANATION_PROJECTION": return `${event.itemId ?? "*"}:${p.disclosurePhase}`;
    case "SERVER_TOOL_REGISTRY": return `${p.toolId}:${p.useId}`;
    case "TEACHER_RECORDED": return p.recordingId;
    case "OFFLINE_DEVICE_REPLAY": return `${p.deviceId}:${p.clientSequence}`;
  }
}

/** Server-derived idempotency key; clients never choose it. */
export function assistanceIdempotencyKey(attemptId: string, event: AssistanceLedgerEvent): string {
  if (event.type === "CONFLICT") throw new Error("assistance_conflict_not_appendable");
  const ref = event.type === "ASSISTANCE" ? `${event.provenance.emitter}|${sourceRef(event)}` : event.type;
  if (!ref || /\|$/.test(ref)) throw new Error("assistance_source_reference_required");
  return sha256(canonicalizeJson({ domain: "liberialearn.assistance.idem.v1", attemptId, ref }));
}

export function emptyAssistanceLedger(scope: AssistanceLedgerScope): AssistanceLedger {
  for (const [key, value] of Object.entries(scope)) if (typeof value !== "string" || value === "") throw new Error(`assistance_scope_${key}_required`);
  return Object.freeze({ version: ASSISTANCE_LEDGER_VERSION, scope: Object.freeze({ ...scope }), entries: Object.freeze([]) });
}

type Opened = Extract<AssistanceLedgerEvent, { type: "OPENED" }>;
const openedEntry = (ledger: AssistanceLedger) => ledger.entries.find((entry) => entry.event.type === "OPENED");
const sealedEntry = (ledger: AssistanceLedger) => ledger.entries.find((entry) => entry.event.type === "SEALED");

function seal(ledger: AssistanceLedger, idempotencyKey: string, event: AssistanceLedgerEvent, occurredAt: string, recordedAt: string): AssistanceLedger {
  const last = ledger.entries[ledger.entries.length - 1];
  const unsealed: Omit<AssistanceLedgerEntry, "entryHash"> = {
    ledgerVersion: ASSISTANCE_LEDGER_VERSION, sequence: ledger.entries.length, idempotencyKey, scope: ledger.scope,
    event: Object.freeze({ ...event }) as AssistanceLedgerEvent, occurredAt, recordedAt, prevHash: last?.entryHash ?? GENESIS,
  };
  const entry = Object.freeze({ ...unsealed, entryHash: hashEntry(unsealed) });
  return Object.freeze({ ...ledger, entries: Object.freeze([...ledger.entries, entry]) });
}

function auditFor(ledger: AssistanceLedger, entry: AssistanceLedgerEntry): AssessmentAuditEvent {
  const { event } = entry;
  const type = event.type === "OPENED" ? "assessment.assistance.opened" : event.type === "SEALED" ? "assessment.assistance.sealed"
    : event.type === "CONFLICT" ? "assessment.assistance.conflict" : "assessment.assistance.recorded";
  const teacher = event.type === "ASSISTANCE" && event.provenance.emitter === "TEACHER_RECORDED" ? event.provenance : null;
  return auditEvent({
    type,
    subjectRef: `attempt:${ledger.scope.attemptId}#${entry.entryHash}`,
    actor: teacher ? { kind: "HUMAN", id: teacher.teacherUserId, role: "TEACHER" }
      : { kind: "SYSTEM", id: event.type === "ASSISTANCE" ? event.provenance.emitter : "assessment-attempt", role: null },
    schoolId: ledger.scope.schoolId,
    occurredAt: entry.recordedAt,
    details: { sequence: entry.sequence, event: event.type, kind: event.type === "ASSISTANCE" ? event.kind : null, itemId: event.type === "ASSISTANCE" ? event.itemId : null },
  });
}

/**
 * Append one event. `recordedAt` is the server clock at the time of the write.
 * Returns `appended: false` for an exact replay, and `conflict: true` when a different payload arrived
 * under an existing key (a CONFLICT entry is appended instead of the event).
 */
export function appendAssistance(ledger: AssistanceLedger, input: { scope: AssistanceLedgerScope; event: AssistanceLedgerEvent; recordedAt: string }): Readonly<{
  ledger: AssistanceLedger; appended: boolean; conflict: boolean; audit: AssessmentAuditEvent | null;
}> {
  if (canonicalizeJson(input.scope) !== canonicalizeJson(ledger.scope)) throw new Error("assistance_scope_mismatch");
  assertIsoTimestamp(input.recordedAt, "assistance_recorded_at");
  const { event } = input;
  if (event.type === "CONFLICT") throw new Error("assistance_conflict_not_appendable");
  const idempotencyKey = assistanceIdempotencyKey(ledger.scope.attemptId, event);
  const prior = ledger.entries.find((entry) => entry.idempotencyKey === idempotencyKey && entry.event.type !== "CONFLICT");
  if (prior) {
    if (payloadDigest(prior.scope, prior.event) === payloadDigest(ledger.scope, event)) {
      return Object.freeze({ ledger, appended: false, conflict: false, audit: null });
    }
    const conflict: AssistanceLedgerEvent = { type: "CONFLICT", idempotencyKey, priorEntryHash: prior.entryHash, rejectedPayloadDigest: payloadDigest(ledger.scope, event) };
    const conflictKey = sha256(`${idempotencyKey}:conflict:${conflict.rejectedPayloadDigest}`);
    // The same conflicting payload re-delivered (e.g. a retried sync batch) is already on record.
    if (ledger.entries.some((entry) => entry.idempotencyKey === conflictKey)) return Object.freeze({ ledger, appended: false, conflict: true, audit: null });
    // A conflict is admitted under the same window rules as the event it contradicts.
    const sealAt = sealedEntry(ledger)?.occurredAt;
    if (sealAt) {
      const offline = event.type === "ASSISTANCE" && event.provenance.emitter === "OFFLINE_DEVICE_REPLAY" ? event.provenance : null;
      if (!offline || Date.parse(offline.capturedAt) > Date.parse(sealAt)) throw new Error("assistance_ledger_sealed");
    }
    if (ledger.entries.filter((entry) => entry.event.type === "CONFLICT").length >= MAX_ASSISTANCE_CONFLICTS) throw new Error("assistance_conflict_limit_reached");
    const next = seal(ledger, conflictKey, conflict, input.recordedAt, input.recordedAt);
    return Object.freeze({ ledger: next, appended: true, conflict: true, audit: auditFor(next, next.entries[next.entries.length - 1]) });
  }

  const openEntry = openedEntry(ledger);
  const sealEntry = sealedEntry(ledger);
  let occurredAt = input.recordedAt;
  if (event.type === "OPENED") {
    if (openEntry) throw new Error("assistance_ledger_already_opened");
    for (const channel of [...event.availableChannels, ...event.instrumentedChannels]) {
      if (!ASSISTANCE_CHANNELS.includes(channel)) throw new Error("assistance_channel_unknown");
    }
  } else {
    if (!openEntry) throw new Error("assistance_ledger_not_opened");
    if (event.type === "SEALED" && sealEntry) throw new Error("assistance_ledger_already_sealed");
    if (event.type === "ASSISTANCE") {
      if (!Object.prototype.hasOwnProperty.call(ASSISTANCE_KIND_CHANNEL, event.kind)) throw new Error("assistance_kind_unknown");
      const allowed = Object.prototype.hasOwnProperty.call(EMITTER_KINDS, event.provenance.emitter) ? EMITTER_KINDS[event.provenance.emitter] : [];
      if (!allowed.includes(event.kind)) throw new Error("assistance_kind_not_permitted_for_emitter");
      const p = event.provenance;
      if (p.emitter === "OFFLINE_DEVICE_REPLAY") {
        if (!(openEntry.event as Opened).offlineDeviceIds.includes(p.deviceId)) throw new Error("assistance_offline_device_not_bound");
        if (!Number.isInteger(p.clientSequence) || p.clientSequence < 0) throw new Error("assistance_offline_sequence_invalid");
        assertIsoTimestamp(p.capturedAt, "assistance_captured_at");
        if (Date.parse(p.capturedAt) > Date.parse(input.recordedAt) + CLOCK_SKEW_MS) throw new Error("assistance_capture_time_in_future");
        occurredAt = p.capturedAt;
        // After the seal only moments captured before it may still arrive from a device queue.
        if (sealEntry && Date.parse(p.capturedAt) > Date.parse(sealEntry.occurredAt)) throw new Error("assistance_ledger_sealed");
      } else if (sealEntry) {
        throw new Error("assistance_ledger_sealed");
      }
    }
    if (Date.parse(occurredAt) < Date.parse(openEntry.occurredAt)) throw new Error("assistance_event_before_open");
  }
  const next = seal(ledger, idempotencyKey, event, occurredAt, input.recordedAt);
  return Object.freeze({ ledger: next, appended: true, conflict: false, audit: auditFor(next, next.entries[next.entries.length - 1]) });
}

/** Recompute the hash chain; any edit, reorder, removal or foreign-scope entry is detected. */
export function verifyAssistanceChain(ledger: AssistanceLedger): boolean {
  if (ledger.version !== ASSISTANCE_LEDGER_VERSION) return false;
  let prev = GENESIS;
  return ledger.entries.every((entry, index) => {
    const { entryHash, ...rest } = entry;
    const ok = entry.ledgerVersion === ASSISTANCE_LEDGER_VERSION && entry.sequence === index && entry.prevHash === prev
      && hashEntry(rest) === entryHash && canonicalizeJson(entry.scope) === canonicalizeJson(ledger.scope);
    prev = entryHash;
    return ok;
  });
}

export type ItemAssistanceExposure = Readonly<{
  hintsRevealed: number;
  aiTutorUsed: boolean;
  explanationSeenBeforeResponse: boolean;
  answerRevealedBeforeResponse: boolean;
  prohibitedToolUsed: boolean;
  peerCollaboration: boolean;
}>;

export type AssistanceStatus = "INDEPENDENT" | "ASSISTED" | "UNVERIFIED";

export type ItemAssistanceClassification = Readonly<{
  status: AssistanceStatus;
  exposure: ItemAssistanceExposure;
  kinds: readonly AssistanceKind[];
  /** Why the record cannot attest independence; empty only for INDEPENDENT. */
  reasons: readonly string[];
}>;

const NO_EXPOSURE: ItemAssistanceExposure = Object.freeze({ hintsRevealed: 0, aiTutorUsed: false, explanationSeenBeforeResponse: false, answerRevealedBeforeResponse: false, prohibitedToolUsed: false, peerCollaboration: false });

/**
 * Independence of one item. Item-scoped events count for that item; attempt-wide events (itemId null,
 * e.g. a tutor turn) count for every item (conservative reading, academic-policy decision P5).
 * A broken chain is not trusted for anything, including the assistance it appears to record.
 */
export function classifyAssistanceForItem(ledger: AssistanceLedger | null, itemId: string): ItemAssistanceClassification {
  if (!ledger) return Object.freeze({ status: "UNVERIFIED", exposure: NO_EXPOSURE, kinds: Object.freeze([]), reasons: Object.freeze(["assistance_record_missing"]) });
  if (!verifyAssistanceChain(ledger)) return Object.freeze({ status: "UNVERIFIED", exposure: NO_EXPOSURE, kinds: Object.freeze([]), reasons: Object.freeze(["assistance_ledger_chain_invalid"]) });
  const reasons: string[] = [];
  const open = openedEntry(ledger)?.event as Opened | undefined;
  if (!open) reasons.push("assistance_ledger_not_opened");
  if (!sealedEntry(ledger)) reasons.push("assistance_ledger_not_sealed");
  if (ledger.entries.some((entry) => entry.event.type === "CONFLICT")) reasons.push("assistance_ledger_conflict");
  if (open) {
    // Every channel must be instrumented. The server's own "available" list is recorded but never
    // trusted to shrink what has to be watched: an empty list cannot make a record independent.
    const uninstrumented = ASSISTANCE_CHANNELS.filter((channel) => !open.instrumentedChannels.includes(channel));
    if (uninstrumented.length > 0) reasons.push(`assistance_channels_not_instrumented:${[...uninstrumented].sort().join(",")}`);
  }
  const events = ledger.entries.map((entry) => entry.event)
    .filter((event): event is Extract<AssistanceLedgerEvent, { type: "ASSISTANCE" }> => event.type === "ASSISTANCE" && (event.itemId === null || event.itemId === itemId));
  const kinds = [...new Set(events.map((event) => event.kind))];
  const exposure: ItemAssistanceExposure = Object.freeze({
    hintsRevealed: events.filter((event) => event.kind === "HINT_REVEALED").length,
    aiTutorUsed: kinds.includes("TUTOR_TURN"),
    explanationSeenBeforeResponse: kinds.includes("EXPLANATION_SHOWN") || kinds.includes("WORKED_EXAMPLE_SHOWN"),
    answerRevealedBeforeResponse: kinds.includes("ANSWER_SHOWN"),
    prohibitedToolUsed: kinds.includes("PROHIBITED_TOOL_USED"),
    peerCollaboration: kinds.includes("PEER_COLLABORATION_OBSERVED"),
  });
  // Recorded assistance is a fact even when the record is otherwise incomplete; it is never independent.
  if (kinds.some((kind) => !NEUTRAL_KINDS.includes(kind))) return Object.freeze({ status: "ASSISTED", exposure, kinds: Object.freeze(kinds), reasons: Object.freeze(reasons) });
  if (reasons.length > 0) return Object.freeze({ status: "UNVERIFIED", exposure, kinds: Object.freeze(kinds), reasons: Object.freeze(reasons) });
  return Object.freeze({ status: "INDEPENDENT", exposure, kinds: Object.freeze(kinds), reasons: Object.freeze([]) });
}

/** What verified and admitted evidence carries: the exact record state its independence was read from. */
export type AssistanceAttestation = Readonly<{
  ledgerVersion: typeof ASSISTANCE_LEDGER_VERSION;
  attemptId: string;
  sessionId: string;
  itemId: string;
  headSequence: number;
  headHash: string;
  sealedAt: string | null;
  status: AssistanceStatus;
  reasons: readonly string[];
  /** From OPENED; null when the record was never opened. Checked against the delivery at verification. */
  independentDelivery: boolean | null;
  /** Devices the record accepts offline capture from. */
  offlineDeviceIds: readonly string[];
}>;

export function attestAssistance(ledger: AssistanceLedger, itemId: string): Readonly<{ attestation: AssistanceAttestation; classification: ItemAssistanceClassification }> {
  const classification = classifyAssistanceForItem(ledger, itemId);
  const head = ledger.entries[ledger.entries.length - 1];
  return Object.freeze({
    classification,
    attestation: Object.freeze({
      ledgerVersion: ASSISTANCE_LEDGER_VERSION,
      attemptId: ledger.scope.attemptId,
      sessionId: ledger.scope.sessionId,
      itemId,
      headSequence: head ? head.sequence : -1,
      headHash: head ? head.entryHash : GENESIS,
      sealedAt: sealedEntry(ledger)?.occurredAt ?? null,
      status: classification.status,
      reasons: classification.reasons,
      independentDelivery: (openedEntry(ledger)?.event as Opened | undefined)?.independentDelivery ?? null,
      offlineDeviceIds: Object.freeze([...((openedEntry(ledger)?.event as Opened | undefined)?.offlineDeviceIds ?? [])]),
    }),
  });
}
