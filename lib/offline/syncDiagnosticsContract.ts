/**
 * Learner sync support diagnostics: the privacy contract shared by the
 * learner-side snapshot reporter, the sync route's outcome recorder, and the
 * read-only support view.
 *
 * Everything here is diagnostic telemetry. It never carries operation
 * payloads, answers, lesson content, server/client state bodies, or free-text
 * errors, and nothing in the learning, grading, or mastery paths reads it.
 * Every value crossing a trust boundary is rebuilt from explicit allowlists;
 * unknown keys are dropped rather than passed through.
 */

export const SYNC_DIAGNOSTIC_SCHEMA_VERSION = 1;
export const SYNC_DIAGNOSTIC_SNAPSHOT_METRIC = "offline.sync.snapshot";
export const SYNC_RESULT_METRIC = "sync.result";

/** Snapshots older than this describe the device, not the present. */
export const SNAPSHOT_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
export const MAX_SNAPSHOT_OPERATIONS = 25;
export const MAX_RECORDED_OUTCOMES = 50;

export const SYNC_DIAGNOSTIC_STATES = [
  "OFFLINE",
  "AUTH_EXPIRED",
  "WAITING_FOR_ORIGINAL_LEARNER",
  "STALE_RELEASE",
  "QUARANTINED",
  "SERVER_CONFLICT",
  "RETRY_PENDING",
  "SERVER_RECEIVED",
  "SYNCED",
  "UNKNOWN",
] as const;
export type SyncDiagnosticState = (typeof SYNC_DIAGNOSTIC_STATES)[number];

export const SYNC_OPERATION_CATEGORIES = [
  "lesson_progress",
  "assessment_attempt",
  "assignment_draft",
  "assignment_submission",
  "homework_submission",
  "lab_session",
  "attendance",
  "mastery_event",
  "learning_observation",
  "simulation_state",
  "legacy_unknown",
] as const;
export type SyncOperationCategory = (typeof SYNC_OPERATION_CATEGORIES)[number];

/** Device queue states that still hold unconfirmed learner work. */
export const UNACKNOWLEDGED_QUEUE_STATES = [
  "LOCAL_PENDING",
  "SENDING",
  "RETRYABLE_FAILURE",
  "AUTH_REQUIRED",
  "CONFLICT",
  "TERMINAL_FAILURE",
] as const;
export type UnacknowledgedQueueState = (typeof UNACKNOWLEDGED_QUEUE_STATES)[number];

export const SERVER_VERDICTS = ["ACCEPTED", "ALREADY_RECEIVED", "SKIPPED", "CONFLICT", "REJECTED"] as const;
export type ServerVerdict = (typeof SERVER_VERDICTS)[number];

const WAITING_FOR_LEARNER_CODES = ["learner_identity_unbound", "learner_identity_mismatch"] as const;
const STALE_RELEASE_CODES = [
  "content_version_changed",
  "content_hash_mismatch",
  "lesson_release_identity_required",
  "content_revoked_evidence_preserved",
  "incompatible_client_protocol",
] as const;
const AUTH_CODES = ["auth_redirected", "auth_required_401", "auth_required_403"] as const;
const RETRYABLE_CODES = [
  "network_unavailable",
  "retryable_server_failure",
  "concurrent_duplicate_retry",
  "sync_response_unrecognized",
] as const;

/**
 * Reason codes emitted by /api/student/sync, the offline-sync policies, and
 * the client drain. Anything else (including free-text server errors, which
 * can echo request content) collapses to "other".
 */
export const SYNC_REASON_CODES = new Set<string>([
  ...WAITING_FOR_LEARNER_CODES,
  ...STALE_RELEASE_CODES,
  ...AUTH_CODES,
  ...RETRYABLE_CODES,
  "assessment_attempt_already_recorded",
  "assessment_attempt_id_conflict",
  "assessment_context_unavailable",
  "assignment_context_unavailable",
  "assignment_enrollment_required",
  "assignment_graded_server_wins",
  "assignment_target_mismatch",
  "assignment_tenant_mismatch",
  "attendance_last_write_wins_by_timestamp",
  "attendance_student_mismatch",
  "attendance_tenant_mismatch",
  "completed_lab_session_requires_review",
  "content_not_found",
  "homework_tenant_or_enrollment_mismatch",
  "idempotency_key_payload_mismatch",
  "invalid_assessment_attempt",
  "invalid_assignment_submission",
  "invalid_lab_session",
  "invalid_offline_operation",
  "invalid_provisional_lab_score",
  "lab_session_tenant_mismatch",
  "malformed_offline_operation",
  "offline_client_cannot_assert_mastery",
  "offline_resource_not_supported",
  "raw_observation_recorded",
  "replay_deduped",
  "scheduled_work_tenant_or_content_mismatch",
  "server_conflict",
  "server_rejected_operation",
  "student_progress_last_write_wins_by_timestamp",
  "submission_graded_server_wins",
  "submission_last_write_wins_by_timestamp",
  "tenant_or_student_identity_mismatch",
]);

const HTTP_CODE = /^http[ _]([1-5]\d\d)$/i;
const OPERATION_ID = /^[A-Za-z0-9._:-]{1,80}$/;
const VERSION_TOKEN = /^[A-Za-z0-9._-]{1,64}$/;
const MAX_COUNT = 100_000;
const MAX_SECONDS = 10 * 365 * 24 * 60 * 60;

export function normalizeReasonCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (SYNC_REASON_CODES.has(trimmed)) return trimmed;
  const http = trimmed.match(HTTP_CODE);
  if (http) return `http_${http[1]}`;
  return "other";
}

export function normalizeCategory(value: unknown): SyncOperationCategory {
  return typeof value === "string" && (SYNC_OPERATION_CATEGORIES as readonly string[]).includes(value)
    ? (value as SyncOperationCategory)
    : "legacy_unknown";
}

function count(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.floor(value), MAX_COUNT);
}

function seconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.floor(value), MAX_SECONDS);
}

function token(value: unknown): string | null {
  return typeof value === "string" && VERSION_TOKEN.test(value) ? value : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export type SyncDiagnosticCounts = {
  /** Operations not yet confirmed by the server. */
  unacknowledged: number;
  localPending: number;
  sending: number;
  retryPending: number;
  authRequired: number;
  conflict: number;
  quarantined: number;
  /** Confirmed evidence the device retains for local history. */
  acknowledgedRetained: number;
};

export type SyncDiagnosticOperation = {
  operationId: string;
  category: SyncOperationCategory;
  queueState: UnacknowledgedQueueState;
  reasonCode: string | null;
  ageSeconds: number | null;
  retryCount: number;
};

export type SyncDiagnosticSnapshot = {
  schemaVersion: typeof SYNC_DIAGNOSTIC_SCHEMA_VERSION;
  capturedAt: string;
  online: boolean | null;
  clientVersion: string | null;
  appRelease: string | null;
  protocolVersion: number | null;
  counts: SyncDiagnosticCounts;
  categories: Partial<Record<SyncOperationCategory, number>>;
  reasonCodes: Record<string, number>;
  oldestPendingAgeSeconds: number | null;
  maxRetryCount: number | null;
  nextRetryInSeconds: number | null;
  releaseSequence: { revision: number; governance: number } | null;
  operations: SyncDiagnosticOperation[];
};

const COUNT_KEYS: Array<keyof SyncDiagnosticCounts> = [
  "unacknowledged",
  "localPending",
  "sending",
  "retryPending",
  "authRequired",
  "conflict",
  "quarantined",
  "acknowledgedRetained",
];

/**
 * Rebuilds a snapshot from untrusted input using only allowlisted fields.
 * Used on write (learner report) and again on read (defense in depth against
 * anything stored before or outside this contract). Returns null when the
 * input is not a usable snapshot.
 */
export function sanitizeSyncDiagnosticSnapshot(input: unknown): SyncDiagnosticSnapshot | null {
  const raw = record(input);
  if (!raw || raw.schemaVersion !== SYNC_DIAGNOSTIC_SCHEMA_VERSION) return null;
  const capturedAt = isoTimestamp(raw.capturedAt);
  const rawCounts = record(raw.counts);
  if (!capturedAt || !rawCounts) return null;

  const counts = {} as SyncDiagnosticCounts;
  for (const key of COUNT_KEYS) {
    const value = count(rawCounts[key]);
    if (value === null) return null;
    counts[key] = value;
  }

  const categories: Partial<Record<SyncOperationCategory, number>> = {};
  for (const [key, value] of Object.entries(record(raw.categories) ?? {})) {
    const n = count(value);
    if (n === null || n === 0) continue;
    const category = normalizeCategory(key);
    categories[category] = Math.min((categories[category] ?? 0) + n, MAX_COUNT);
  }

  const reasonCodes: Record<string, number> = {};
  for (const [key, value] of Object.entries(record(raw.reasonCodes) ?? {})) {
    const n = count(value);
    const code = normalizeReasonCode(key);
    if (n === null || n === 0 || !code) continue;
    reasonCodes[code] = Math.min((reasonCodes[code] ?? 0) + n, MAX_COUNT);
  }

  const rawSequence = record(raw.releaseSequence);
  const revision = count(rawSequence?.revision);
  const governance = count(rawSequence?.governance);

  const operations: SyncDiagnosticOperation[] = [];
  for (const entry of Array.isArray(raw.operations) ? raw.operations.slice(0, MAX_SNAPSHOT_OPERATIONS) : []) {
    const op = record(entry);
    if (!op || typeof op.operationId !== "string" || !OPERATION_ID.test(op.operationId)) continue;
    if (!(UNACKNOWLEDGED_QUEUE_STATES as readonly unknown[]).includes(op.queueState)) continue;
    operations.push({
      operationId: op.operationId,
      category: normalizeCategory(op.category),
      queueState: op.queueState as UnacknowledgedQueueState,
      reasonCode: normalizeReasonCode(op.reasonCode),
      ageSeconds: seconds(op.ageSeconds),
      retryCount: count(op.retryCount) ?? 0,
    });
  }

  return {
    schemaVersion: SYNC_DIAGNOSTIC_SCHEMA_VERSION,
    capturedAt,
    online: typeof raw.online === "boolean" ? raw.online : null,
    clientVersion: token(raw.clientVersion),
    appRelease: token(raw.appRelease),
    protocolVersion: count(raw.protocolVersion),
    counts,
    categories,
    reasonCodes,
    oldestPendingAgeSeconds: seconds(raw.oldestPendingAgeSeconds),
    maxRetryCount: count(raw.maxRetryCount),
    nextRetryInSeconds: seconds(raw.nextRetryInSeconds),
    releaseSequence: revision !== null && revision >= 1 && governance !== null ? { revision, governance } : null,
    operations,
  };
}

export type ServerSyncOutcome = {
  operationId: string | null;
  category: SyncOperationCategory;
  verdict: ServerVerdict;
  reasonCode: string | null;
};

/** Maps one /api/student/sync result to its payload-free server verdict. */
export function toServerSyncOutcome(
  result: { status?: string; resolutionHint?: string },
  operationId: unknown,
  category: unknown,
): ServerSyncOutcome {
  const reasonCode = normalizeReasonCode(result.resolutionHint);
  let verdict: ServerVerdict;
  if (result.status === "synced") verdict = "ACCEPTED";
  else if (result.status === "conflict") verdict = "CONFLICT";
  else if (reasonCode === "replay_deduped" || reasonCode === "assessment_attempt_already_recorded") verdict = "ALREADY_RECEIVED";
  else if (result.status === "skipped") verdict = "SKIPPED";
  else verdict = "REJECTED";
  return {
    operationId: typeof operationId === "string" && OPERATION_ID.test(operationId) ? operationId : null,
    category: normalizeCategory(category),
    verdict,
    reasonCode,
  };
}

export function sanitizeServerSyncOutcomes(input: unknown): ServerSyncOutcome[] {
  if (!Array.isArray(input)) return [];
  const outcomes: ServerSyncOutcome[] = [];
  for (const entry of input.slice(0, MAX_RECORDED_OUTCOMES)) {
    const raw = record(entry);
    if (!raw || !(SERVER_VERDICTS as readonly unknown[]).includes(raw.verdict)) continue;
    outcomes.push({
      operationId: typeof raw.operationId === "string" && OPERATION_ID.test(raw.operationId) ? raw.operationId : null,
      category: normalizeCategory(raw.category),
      verdict: raw.verdict as ServerVerdict,
      reasonCode: normalizeReasonCode(raw.reasonCode),
    });
  }
  return outcomes;
}

export type TimedServerOutcome = ServerSyncOutcome & { receivedAt: string };

export type SyncStateDerivation = {
  primaryState: SyncDiagnosticState;
  activeStates: SyncDiagnosticState[];
  /** True when the newest device report is too old to describe the present. */
  snapshotStale: boolean | null;
};

function hasAnyCode(codes: Record<string, number>, group: readonly string[]): boolean {
  return group.some((code) => (codes[code] ?? 0) > 0);
}

/**
 * Derives reason-coded states. Only a device report can prove the queue is
 * empty, so SYNCED is never inferred from server evidence alone, and missing
 * evidence yields UNKNOWN rather than a zero or success state.
 */
export function deriveSyncDiagnosticStates(input: {
  snapshot: SyncDiagnosticSnapshot | null;
  snapshotReceivedAt: Date | null;
  outcomes: TimedServerOutcome[];
  now: Date;
}): SyncStateDerivation {
  const { snapshot, snapshotReceivedAt, outcomes, now } = input;
  const states = new Set<SyncDiagnosticState>();

  const latestByOperation = new Map<string, TimedServerOutcome>();
  for (const outcome of outcomes) {
    if (!outcome.operationId) continue;
    const prior = latestByOperation.get(outcome.operationId);
    if (!prior || prior.receivedAt < outcome.receivedAt) latestByOperation.set(outcome.operationId, outcome);
  }
  const serverReceived = (id: string) => {
    const verdict = latestByOperation.get(id)?.verdict;
    return verdict === "ACCEPTED" || verdict === "ALREADY_RECEIVED" || verdict === "SKIPPED";
  };

  let snapshotStale: boolean | null = null;
  if (snapshot && snapshotReceivedAt) {
    snapshotStale = now.getTime() - snapshotReceivedAt.getTime() > SNAPSHOT_STALE_AFTER_MS;
    const { counts, reasonCodes } = snapshot;
    const lastServerContact = outcomes.reduce(
      (latest, o) => (o.receivedAt > latest ? o.receivedAt : latest),
      snapshotReceivedAt.toISOString(),
    );
    const contactStale = now.getTime() - Date.parse(lastServerContact) > SNAPSHOT_STALE_AFTER_MS;

    if (snapshot.online === false || (contactStale && counts.unacknowledged > 0)) states.add("OFFLINE");
    if (counts.authRequired > 0 || hasAnyCode(reasonCodes, AUTH_CODES)) states.add("AUTH_EXPIRED");
    if (hasAnyCode(reasonCodes, WAITING_FOR_LEARNER_CODES)) states.add("WAITING_FOR_ORIGINAL_LEARNER");
    if (hasAnyCode(reasonCodes, STALE_RELEASE_CODES)) states.add("STALE_RELEASE");
    if (counts.quarantined > 0) states.add("QUARANTINED");
    if (counts.conflict > 0) states.add("SERVER_CONFLICT");
    // Queued-but-unsent work is waiting on the next drain, which is the same
    // support posture as a scheduled retry.
    if (counts.retryPending > 0 || counts.localPending + counts.sending > 0) states.add("RETRY_PENDING");
    if (snapshot.operations.some((op) => serverReceived(op.operationId))) states.add("SERVER_RECEIVED");
    if (counts.unacknowledged === 0 && states.size === 0) states.add("SYNCED");
  } else {
    for (const outcome of latestByOperation.values()) {
      const code = outcome.reasonCode ?? "";
      if ((WAITING_FOR_LEARNER_CODES as readonly string[]).includes(code)) states.add("WAITING_FOR_ORIGINAL_LEARNER");
      else if ((STALE_RELEASE_CODES as readonly string[]).includes(code)) states.add("STALE_RELEASE");
      else if (outcome.verdict === "CONFLICT") states.add("SERVER_CONFLICT");
      else if ((RETRYABLE_CODES as readonly string[]).includes(code)) states.add("RETRY_PENDING");
      else if (outcome.verdict !== "REJECTED") states.add("SERVER_RECEIVED");
    }
  }

  if (states.size === 0) states.add("UNKNOWN");
  const activeStates = SYNC_DIAGNOSTIC_STATES.filter((state) => states.has(state));
  return { primaryState: activeStates[0], activeStates, snapshotStale };
}
