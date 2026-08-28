/**
 * Canonical P5-B offline operation contract.
 *
 * The browser queue stores operations, never arbitrary replacement snapshots.
 * This module is deliberately dependency-free so the same validation and
 * fingerprint rules can run in browser code, the service worker boundary, and
 * the server sync endpoint.
 */

export const OFFLINE_SYNC_PROTOCOL_VERSION = 1;
export const MAX_OFFLINE_OPERATION_PAYLOAD_BYTES = 256 * 1024;
export const MAX_OFFLINE_BATCH_SIZE = 50;

export type OfflineResourceType =
  | "lesson_progress"
  | "assessment_attempt"
  | "assignment_draft"
  | "assignment_submission"
  | "homework_submission"
  | "lab_session"
  | "attendance"
  | "mastery_event"
  | "simulation_state";

export type OfflineOperationType =
  | "progress.complete"
  | "assessment_attempt.append"
  | "assignment.draft.save"
  | "assignment.submit"
  | "homework.submit"
  | "lab_session.merge"
  | "attendance.mark"
  | "mastery_event.append"
  | "simulation_state.merge";

export type OfflineSyncStatus =
  | "LOCAL_PENDING"
  | "SENDING"
  | "ACKNOWLEDGED"
  | "CONFLICT"
  | "RETRYABLE_FAILURE"
  | "TERMINAL_FAILURE";

export type OfflineOperation = {
  protocolVersion: number;
  operationId: string;
  learnerId: string | null;
  schoolId: string | null;
  resourceType: OfflineResourceType;
  resourceId: string;
  contentId: string | null;
  contentVersion: string | null;
  contentHash: string | null;
  manifestSequence: { revision: number; governance: number } | null;
  operationType: OfflineOperationType;
  payload: Record<string, unknown>;
  clientCreatedAt: string;
  baseServerVersion: string | null;
  idempotencyKey: string;
  dependencyIds: string[];
};

export type OfflineWritePolicy =
  | "APPEND_ONLY"
  | "LAST_WRITER_SAFE"
  | "MERGEABLE"
  | "SERVER_AUTHORITATIVE"
  | "REQUIRES_CONFLICT_REVIEW"
  | "NOT_SUPPORTED_OFFLINE";

export const OFFLINE_WRITE_POLICIES: Record<OfflineResourceType, OfflineWritePolicy> = {
  lesson_progress: "MERGEABLE",
  assessment_attempt: "APPEND_ONLY",
  assignment_draft: "LAST_WRITER_SAFE",
  assignment_submission: "REQUIRES_CONFLICT_REVIEW",
  homework_submission: "REQUIRES_CONFLICT_REVIEW",
  lab_session: "MERGEABLE",
  attendance: "REQUIRES_CONFLICT_REVIEW",
  mastery_event: "APPEND_ONLY",
  simulation_state: "MERGEABLE",
};

const OPERATION_TYPES_BY_RESOURCE: Record<OfflineResourceType, OfflineOperationType> = {
  lesson_progress: "progress.complete",
  assessment_attempt: "assessment_attempt.append",
  assignment_draft: "assignment.draft.save",
  assignment_submission: "assignment.submit",
  homework_submission: "homework.submit",
  lab_session: "lab_session.merge",
  attendance: "attendance.mark",
  mastery_event: "mastery_event.append",
  simulation_state: "simulation_state.merge",
};

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("offline_payload_non_finite_number");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
    );
  }
  throw new Error("offline_payload_invalid_value");
}

export function canonicalOfflineJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}

/** Stable comparison value for same-key/different-payload detection. */
export function offlineOperationFingerprint(operation: Pick<OfflineOperation, "operationType" | "resourceType" | "resourceId" | "contentId" | "contentVersion" | "contentHash" | "payload">): string {
  return canonicalOfflineJson({
    operationType: operation.operationType,
    resourceType: operation.resourceType,
    resourceId: operation.resourceId,
    contentId: operation.contentId,
    contentVersion: operation.contentVersion,
    contentHash: operation.contentHash,
    payload: operation.payload,
  });
}

export function validateOfflineOperation(value: unknown): value is OfflineOperation {
  if (!isRecord(value)) return false;
  if (value.protocolVersion !== OFFLINE_SYNC_PROTOCOL_VERSION) return false;
  if (typeof value.operationId !== "string" || value.operationId.trim().length < 8) return false;
  if (value.learnerId !== null && typeof value.learnerId !== "string") return false;
  if (value.schoolId !== null && typeof value.schoolId !== "string") return false;
  if (typeof value.resourceType !== "string" || !(value.resourceType in OFFLINE_WRITE_POLICIES)) return false;
  if (typeof value.operationType !== "string" || OPERATION_TYPES_BY_RESOURCE[value.resourceType as OfflineResourceType] !== value.operationType) return false;
  if (typeof value.resourceId !== "string" || value.resourceId.trim().length === 0) return false;
  for (const key of ["contentId", "contentVersion", "contentHash", "baseServerVersion"]) {
    if (value[key] !== null && typeof value[key] !== "string") return false;
  }
  if (value.contentHash !== null && (typeof value.contentHash !== "string" || !HASH_PATTERN.test(value.contentHash))) return false;
  if (!ISO_PATTERN.test(String(value.clientCreatedAt)) || !Number.isFinite(Date.parse(String(value.clientCreatedAt)))) return false;
  if (typeof value.idempotencyKey !== "string" || value.idempotencyKey !== value.operationId) return false;
  if (!isRecord(value.payload)) return false;
  if (!Array.isArray(value.dependencyIds) || value.dependencyIds.some((id) => typeof id !== "string")) return false;
  try {
    return new TextEncoder().encode(canonicalOfflineJson(value.payload)).byteLength <= MAX_OFFLINE_OPERATION_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

export function inferOfflineResource(type: string): { resourceType: OfflineResourceType; operationType: OfflineOperationType } | null {
  switch (type) {
    case "lesson-complete": return { resourceType: "lesson_progress", operationType: "progress.complete" };
    case "assignment-submission": return { resourceType: "assignment_submission", operationType: "assignment.submit" };
    case "homework": return { resourceType: "homework_submission", operationType: "homework.submit" };
    case "lab-submission": return { resourceType: "lab_session", operationType: "lab_session.merge" };
    case "assessment-attempt": return { resourceType: "assessment_attempt", operationType: "assessment_attempt.append" };
    case "attendance": return { resourceType: "attendance", operationType: "attendance.mark" };
    default: return null;
  }
}
