import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  SYNC_DIAGNOSTIC_SCHEMA_VERSION,
  SYNC_DIAGNOSTIC_SNAPSHOT_METRIC,
  SYNC_RESULT_METRIC,
  deriveSyncDiagnosticStates,
  normalizeReasonCode,
  sanitizeSyncDiagnosticSnapshot,
  toServerSyncOutcome,
  type SyncDiagnosticSnapshot,
} from "@/lib/offline/syncDiagnosticsContract";
import { buildSyncDiagnosticSnapshot } from "@/lib/offline/syncDiagnosticsSnapshot";
import { readLearnerSyncDiagnostics, type SupportViewer } from "@/lib/support/learnerSyncDiagnostics";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn(), logAuditRequired: vi.fn() }));

const NOW = new Date("2026-09-25T12:00:00.000Z");
const FORBIDDEN_KEYS = ["payload", "answers", "answer", "answerKey", "correctAnswer", "serverState", "clientState", "contentHash", "resourceId", "body", "guardian", "message", "mastery"];
const SECRET = "SECRET-ANSWER-42";

function snapshot(overrides: Partial<SyncDiagnosticSnapshot> = {}): SyncDiagnosticSnapshot {
  return {
    schemaVersion: SYNC_DIAGNOSTIC_SCHEMA_VERSION,
    capturedAt: "2026-09-25T11:55:00.000Z",
    online: true,
    clientVersion: "1.0.0",
    appRelease: "abc123",
    protocolVersion: 1,
    counts: { unacknowledged: 0, localPending: 0, sending: 0, retryPending: 0, authRequired: 0, conflict: 0, quarantined: 0, acknowledgedRetained: 0 },
    categories: {},
    reasonCodes: {},
    oldestPendingAgeSeconds: null,
    maxRetryCount: null,
    nextRetryInSeconds: null,
    releaseSequence: null,
    operations: [],
    ...overrides,
  };
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => collectKeys(v, keys));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) { keys.add(k); collectKeys(v, keys); }
  }
  return keys;
}

function expectPrivacySafe(value: unknown) {
  const json = JSON.stringify(value);
  expect(json).not.toContain(SECRET);
  const keys = collectKeys(value);
  for (const key of FORBIDDEN_KEYS) expect(keys.has(key), `forbidden key ${key}`).toBe(false);
}

describe("sync diagnostics contract", () => {
  it("rebuilds snapshots from allowlisted fields only and drops payloads and free text", () => {
    const hostile = {
      ...snapshot({ counts: { ...snapshot().counts, unacknowledged: 1, quarantined: 1 } }),
      payload: { answers: [SECRET] },
      guardian: { phone: SECRET },
      reasonCodes: { [`Error: ${SECRET}`]: 2, "HTTP 500": 1, learner_identity_unbound: 1 },
      categories: { lesson_progress: 1, [SECRET]: 3 },
      operations: [{ operationId: "op-1", category: "assessment_attempt", queueState: "TERMINAL_FAILURE", reasonCode: SECRET, ageSeconds: 30, retryCount: 3, payload: { answers: [SECRET] }, serverState: SECRET }],
    };
    const clean = sanitizeSyncDiagnosticSnapshot(hostile)!;
    expect(clean).not.toBeNull();
    expectPrivacySafe(clean);
    expect(clean.reasonCodes).toEqual({ other: 2, http_500: 1, learner_identity_unbound: 1 });
    expect(clean.categories).toEqual({ lesson_progress: 1, legacy_unknown: 3 });
    expect(clean.operations[0]).toEqual({ operationId: "op-1", category: "assessment_attempt", queueState: "TERMINAL_FAILURE", reasonCode: "other", ageSeconds: 30, retryCount: 3 });
  });

  it("rejects snapshots without schema, timestamp, or complete counts", () => {
    expect(sanitizeSyncDiagnosticSnapshot(null)).toBeNull();
    expect(sanitizeSyncDiagnosticSnapshot({ ...snapshot(), schemaVersion: 2 })).toBeNull();
    expect(sanitizeSyncDiagnosticSnapshot({ ...snapshot(), capturedAt: "yesterday" })).toBeNull();
    expect(sanitizeSyncDiagnosticSnapshot({ ...snapshot(), counts: { unacknowledged: 1 } })).toBeNull();
    expect(sanitizeSyncDiagnosticSnapshot({ ...snapshot(), counts: { ...snapshot().counts, quarantined: -1 } })).toBeNull();
  });

  it("normalizes reason codes to a closed vocabulary", () => {
    expect(normalizeReasonCode("content_version_changed")).toBe("content_version_changed");
    expect(normalizeReasonCode("HTTP 404")).toBe("http_404");
    expect(normalizeReasonCode("Unexpected token < in JSON")).toBe("other");
    expect(normalizeReasonCode("")).toBeNull();
    expect(normalizeReasonCode(undefined)).toBeNull();
  });

  it("maps sync results to payload-free server verdicts", () => {
    expect(toServerSyncOutcome({ status: "synced" }, "op-1", "lesson_progress").verdict).toBe("ACCEPTED");
    expect(toServerSyncOutcome({ status: "rejected", resolutionHint: "replay_deduped" }, "op-1", "x").verdict).toBe("ALREADY_RECEIVED");
    expect(toServerSyncOutcome({ status: "skipped", resolutionHint: "assessment_attempt_already_recorded" }, "op-1", "x").verdict).toBe("ALREADY_RECEIVED");
    expect(toServerSyncOutcome({ status: "skipped" }, "op-1", "x").verdict).toBe("SKIPPED");
    expect(toServerSyncOutcome({ status: "conflict", resolutionHint: "content_version_changed" }, "op-1", "x").verdict).toBe("CONFLICT");
    const rejected = toServerSyncOutcome({ status: "rejected", resolutionHint: "learner_identity_mismatch" }, "bad id with spaces", "not-a-category");
    expect(rejected).toEqual({ operationId: null, category: "legacy_unknown", verdict: "REJECTED", reasonCode: "learner_identity_mismatch" });
  });
});

describe("sync diagnostic state derivation", () => {
  const fresh = new Date("2026-09-25T11:56:00.000Z");
  const counts = snapshot().counts;

  it("reports UNKNOWN, not SYNCED, when there is no evidence", () => {
    expect(deriveSyncDiagnosticStates({ snapshot: null, snapshotReceivedAt: null, outcomes: [], now: NOW }).primaryState).toBe("UNKNOWN");
  });

  it("reports SYNCED only from a device report showing an empty queue", () => {
    expect(deriveSyncDiagnosticStates({ snapshot: snapshot(), snapshotReceivedAt: fresh, outcomes: [], now: NOW }).primaryState).toBe("SYNCED");
    const serverOnly = deriveSyncDiagnosticStates({
      snapshot: null, snapshotReceivedAt: null, now: NOW,
      outcomes: [{ operationId: "op-1", category: "lesson_progress", verdict: "ACCEPTED", reasonCode: null, receivedAt: fresh.toISOString() }],
    });
    expect(serverOnly.primaryState).toBe("SERVER_RECEIVED");
    expect(serverOnly.activeStates).not.toContain("SYNCED");
  });

  it.each([
    [{ counts: { ...counts, unacknowledged: 1, authRequired: 1 } }, "AUTH_EXPIRED"],
    [{ counts: { ...counts, unacknowledged: 1, quarantined: 1 }, reasonCodes: { learner_identity_unbound: 1 } }, "WAITING_FOR_ORIGINAL_LEARNER"],
    [{ counts: { ...counts, unacknowledged: 1, conflict: 1 }, reasonCodes: { content_version_changed: 1 } }, "STALE_RELEASE"],
    [{ counts: { ...counts, unacknowledged: 1, quarantined: 1 }, reasonCodes: { http_500: 1 } }, "QUARANTINED"],
    [{ counts: { ...counts, unacknowledged: 1, conflict: 1 }, reasonCodes: { submission_graded_server_wins: 1 } }, "SERVER_CONFLICT"],
    [{ counts: { ...counts, unacknowledged: 1, retryPending: 1 }, reasonCodes: { network_unavailable: 1 } }, "RETRY_PENDING"],
    [{ counts: { ...counts, unacknowledged: 1, localPending: 1 } }, "RETRY_PENDING"],
  ] as const)("derives %j as %s", (overrides, expected) => {
    const result = deriveSyncDiagnosticStates({ snapshot: snapshot(overrides as Partial<SyncDiagnosticSnapshot>), snapshotReceivedAt: fresh, outcomes: [], now: NOW });
    expect(result.primaryState).toBe(expected);
  });

  it("infers OFFLINE when pending work has had no device contact for hours", () => {
    const old = new Date("2026-09-24T12:00:00.000Z");
    const result = deriveSyncDiagnosticStates({
      snapshot: snapshot({ counts: { ...counts, unacknowledged: 2, localPending: 2 } }),
      snapshotReceivedAt: old, outcomes: [], now: NOW,
    });
    expect(result.primaryState).toBe("OFFLINE");
    expect(result.snapshotStale).toBe(true);
  });

  it("marks SERVER_RECEIVED when the server has a verdict for work the device still holds", () => {
    const result = deriveSyncDiagnosticStates({
      snapshot: snapshot({
        counts: { ...counts, unacknowledged: 1, sending: 1 },
        operations: [{ operationId: "op-9", category: "lesson_progress", queueState: "SENDING", reasonCode: null, ageSeconds: 10, retryCount: 0 }],
      }),
      snapshotReceivedAt: fresh, now: NOW,
      outcomes: [{ operationId: "op-9", category: "lesson_progress", verdict: "ACCEPTED", reasonCode: null, receivedAt: fresh.toISOString() }],
    });
    expect(result.activeStates).toContain("SERVER_RECEIVED");
  });
});

describe("device snapshot builder", () => {
  it("summarizes queue bookkeeping without payloads, hashes, or resource IDs", () => {
    const base = {
      protocolVersion: 1, learnerId: "learner-1", schoolId: "school-1", operationType: null, contentId: "lesson-1",
      contentVersion: "v3", contentHash: SECRET, baseServerVersion: null, dependencyIds: [], scheduledWorkId: SECRET,
      completedAt: NOW.toISOString(), updatedAt: NOW.toISOString(), payload: { answers: [SECRET], correctAnswer: SECRET },
    };
    const queue = [
      { ...base, id: "a", operationId: "op-a", idempotencyKey: "op-a", resourceType: "assessment_attempt", resourceId: SECRET, syncState: "TERMINAL_FAILURE", status: "failed", attempts: 3, retryCount: 3, nextRetryAt: null, lastError: `Validation failed: ${SECRET}`, clientCreatedAt: "2026-09-25T10:00:00.000Z", createdAt: "2026-09-25T10:00:00.000Z", manifestSequence: { revision: 4, governance: 1 } },
      { ...base, id: "b", operationId: "op-b", idempotencyKey: "op-b", resourceType: "lesson_progress", resourceId: SECRET, syncState: "AUTH_REQUIRED", status: "pending", attempts: 0, nextRetryAt: null, lastError: "auth_required_401", clientCreatedAt: "2026-09-25T11:00:00.000Z", createdAt: "2026-09-25T11:00:00.000Z", manifestSequence: null },
      { ...base, id: "c", operationId: "op-c", idempotencyKey: "op-c", resourceType: "attendance", resourceId: SECRET, syncState: "CONFLICT", status: "conflict", attempts: 1, nextRetryAt: null, lastError: null, conflict: { serverState: { answers: [SECRET] }, clientState: SECRET, resolutionHint: "content_version_changed" }, clientCreatedAt: "2026-09-25T11:30:00.000Z", createdAt: "2026-09-25T11:30:00.000Z", manifestSequence: null },
      { ...base, id: "d", operationId: "op-d", idempotencyKey: "op-d", resourceType: "learning_observation", resourceId: SECRET, syncState: "ACKNOWLEDGED", status: "acknowledged", attempts: 0, nextRetryAt: null, clientCreatedAt: "2026-09-25T09:00:00.000Z", createdAt: "2026-09-25T09:00:00.000Z", manifestSequence: null },
    ] as any[];
    const result = buildSyncDiagnosticSnapshot(queue, { now: NOW.getTime(), online: true, appRelease: "abc123" })!;
    expectPrivacySafe(result);
    expect(result.counts).toEqual({ unacknowledged: 3, localPending: 0, sending: 0, retryPending: 0, authRequired: 1, conflict: 1, quarantined: 1, acknowledgedRetained: 1 });
    expect(result.categories).toEqual({ assessment_attempt: 1, lesson_progress: 1, attendance: 1 });
    expect(result.reasonCodes).toEqual({ other: 1, auth_required_401: 1, content_version_changed: 1 });
    expect(result.oldestPendingAgeSeconds).toBe(7200);
    expect(result.maxRetryCount).toBe(3);
    expect(result.releaseSequence).toEqual({ revision: 4, governance: 1 });
    expect(result.operations.map((op) => op.operationId)).toEqual(["op-a", "op-b", "op-c"]);
  });
});

type Row = { name: string; payloadJson: unknown; createdAt: Date; userId: string; schoolId: string | null };

function fakeDb(users: Array<{ id: string; name: string | null; role: string; schoolId: string | null }>, rows: Row[] = []) {
  const findMany = vi.fn(async (args: any) =>
    rows
      .filter((r) => r.userId === args.where.userId && r.schoolId === args.where.schoolId && args.where.name.in.includes(r.name) && r.createdAt >= args.where.createdAt.gte)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(({ name, payloadJson, createdAt }) => ({ name, payloadJson, createdAt })),
  );
  return {
    user: { findUnique: vi.fn(async (args: any) => users.find((u) => u.id === args.where.id) ?? null) },
    metricEvent: { findMany },
  };
}

const users = [
  { id: "learner-a", name: "Learner A", role: "STUDENT", schoolId: "school-a" },
  { id: "learner-b", name: "Learner B", role: "STUDENT", schoolId: "school-b" },
  { id: "teacher-a", name: "Teacher A", role: "TEACHER", schoolId: "school-a" },
];
const adminA: SupportViewer = { id: "admin-a", role: "ADMIN", schoolId: "school-a" };

async function expectStatus(promise: Promise<unknown>, status: number) {
  await expect(promise).rejects.toMatchObject({ status });
}

describe("support sync diagnostics authorization", () => {
  it("grants the capability only to school admins and platform admins", () => {
    expect(hasPermission({ role: "ADMIN" }, PERMISSIONS.SUPPORT_SYNC_DIAGNOSTICS_READ)).toBe(true);
    expect(hasPermission({ role: "TEACHER", isPlatformAdmin: true }, PERMISSIONS.SUPPORT_SYNC_DIAGNOSTICS_READ)).toBe(true);
    for (const role of ["TEACHER", "STUDENT", "GUARDIAN", "DISTRICT_ADMIN", "MOE_OFFICIAL", "MOE_SUPER_ADMIN", "MOE_DISTRICT_ADMIN", "UNKNOWN"]) {
      expect(hasPermission({ role }, PERMISSIONS.SUPPORT_SYNC_DIAGNOSTICS_READ), role).toBe(false);
    }
  });

  it.each(["TEACHER", "STUDENT", "GUARDIAN", "DISTRICT_ADMIN", "MOE_OFFICIAL"])("denies %s with 403 before any lookup", async (role) => {
    const db = fakeDb(users);
    const audit = vi.fn();
    await expectStatus(readLearnerSyncDiagnostics({ id: "u", role, schoolId: "school-a" }, "learner-a", { db, audit, now: NOW }), 403);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("denies a school admin without school context", async () => {
    const db = fakeDb(users);
    await expectStatus(readLearnerSyncDiagnostics({ id: "admin-x", role: "ADMIN", schoolId: null }, "learner-a", { db, audit: vi.fn(), now: NOW }), 403);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("hides a learner in another school behind 404 and never reads their evidence", async () => {
    const db = fakeDb(users, [{ name: SYNC_DIAGNOSTIC_SNAPSHOT_METRIC, payloadJson: snapshot(), createdAt: NOW, userId: "learner-b", schoolId: "school-b" }]);
    const audit = vi.fn();
    await expectStatus(readLearnerSyncDiagnostics(adminA, "learner-b", { db, audit, now: NOW }), 404);
    expect(db.metricEvent.findMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "support.sync_diagnostics.denied", userId: "admin-a", resourceId: "learner-b", schoolId: "school-a", details: { reason: "cross_tenant" },
    }));
  });

  it("returns the same 404 for missing learners, non-learners, and malformed IDs", async () => {
    const db = fakeDb(users);
    for (const id of ["nobody", "teacher-a", "../../etc", "x".repeat(65)]) {
      await expectStatus(readLearnerSyncDiagnostics(adminA, id, { db, audit: vi.fn(), now: NOW }), 404);
    }
    expect(db.metricEvent.findMany).not.toHaveBeenCalled();
  });

  it("allows a platform admin across schools and audits the read", async () => {
    const db = fakeDb(users);
    const audit = vi.fn();
    const view = await readLearnerSyncDiagnostics({ id: "root", role: "ADMIN", schoolId: "school-a", isPlatformAdmin: true }, "learner-b", { db, audit, now: NOW });
    expect(view.learner.id).toBe("learner-b");
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "support.sync_diagnostics.viewed", resourceId: "learner-b", schoolId: "school-b" }));
  });

  it("fails closed with 503 and returns no data when the audit write fails", async () => {
    const db = fakeDb(users, [{ name: SYNC_DIAGNOSTIC_SNAPSHOT_METRIC, payloadJson: snapshot(), createdAt: NOW, userId: "learner-a", schoolId: "school-a" }]);
    const audit = vi.fn().mockRejectedValue(new Error("audit_log_unavailable"));
    await expectStatus(readLearnerSyncDiagnostics(adminA, "learner-a", { db, audit, now: NOW }), 503);
  });

  it("scopes evidence to the learner and the learner's current school", async () => {
    const db = fakeDb(users, [
      { name: SYNC_DIAGNOSTIC_SNAPSHOT_METRIC, payloadJson: snapshot({ counts: { ...snapshot().counts, unacknowledged: 9, quarantined: 9 } }), createdAt: NOW, userId: "learner-a", schoolId: "school-old" },
    ]);
    const view = await readLearnerSyncDiagnostics(adminA, "learner-a", { db, audit: vi.fn(), now: NOW });
    expect(db.metricEvent.findMany.mock.calls[0][0].where).toMatchObject({ userId: "learner-a", schoolId: "school-a" });
    expect(view.queue.counts).toBeNull();
  });
});

describe("support sync diagnostics view", () => {
  it("renders unavailable data as null and UNKNOWN, never zero or success", async () => {
    const view = await readLearnerSyncDiagnostics(adminA, "learner-a", { db: fakeDb(users), audit: vi.fn(), now: NOW, serverRelease: null });
    expect(view.primaryState).toBe("UNKNOWN");
    expect(view.lastSuccessfulSyncAt).toBeNull();
    expect(view.lastServerContactAt).toBeNull();
    expect(view.queue).toEqual({ counts: null, categories: null, oldestPendingAgeSeconds: null, maxRetryCount: null, nextRetryInSeconds: null, reasonCodes: null });
    expect(view.device.online).toBeNull();
    expect(view.release.appReleaseMatchesServer).toBeNull();
    expect(view.lastFailure).toBeNull();
  });

  it("diagnoses a stuck learner from device and server evidence without exposing sensitive data", async () => {
    const stored = {
      ...snapshot({
        counts: { ...snapshot().counts, unacknowledged: 2, quarantined: 1, authRequired: 1 },
        categories: { assessment_attempt: 1, lesson_progress: 1 },
        reasonCodes: { http_500: 1, auth_required_401: 1 },
        oldestPendingAgeSeconds: 7200,
        maxRetryCount: 3,
        operations: [
          { operationId: "op-a", category: "assessment_attempt", queueState: "TERMINAL_FAILURE", reasonCode: "http_500", ageSeconds: 7200, retryCount: 3 },
          { operationId: "op-b", category: "lesson_progress", queueState: "AUTH_REQUIRED", reasonCode: "auth_required_401", ageSeconds: 60, retryCount: 0 },
        ],
      }),
      // Anything stored outside the contract must never be echoed back.
      payload: { answers: [SECRET] },
      answerKey: SECRET,
    };
    const rows: Row[] = [
      { name: SYNC_DIAGNOSTIC_SNAPSHOT_METRIC, payloadJson: stored, createdAt: new Date("2026-09-25T11:58:00.000Z"), userId: "learner-a", schoolId: "school-a" },
      { name: SYNC_RESULT_METRIC, payloadJson: { synced: 0, skipped: 1, conflicts: 0, processed: 1, outcomes: [{ operationId: "op-a", category: "assessment_attempt", verdict: "REJECTED", reasonCode: "retryable_server_failure", clientState: { answers: [SECRET] } }] }, createdAt: new Date("2026-09-25T11:00:00.000Z"), userId: "learner-a", schoolId: "school-a" },
      { name: SYNC_RESULT_METRIC, payloadJson: { synced: 1, skipped: 0, conflicts: 0, processed: 1 }, createdAt: new Date("2026-09-24T08:00:00.000Z"), userId: "learner-a", schoolId: "school-a" },
    ];
    const view = await readLearnerSyncDiagnostics(adminA, "learner-a", { db: fakeDb(users, rows), audit: vi.fn(), now: NOW, serverRelease: "abc123" });
    expectPrivacySafe(view);
    expect(view.primaryState).toBe("AUTH_EXPIRED");
    expect(view.activeStates).toEqual(["AUTH_EXPIRED", "QUARANTINED"]);
    expect(view.lastSuccessfulSyncAt).toBe("2026-09-24T08:00:00.000Z");
    expect(view.lastServerContactAt).toBe("2026-09-25T11:58:00.000Z");
    expect(view.release.appReleaseMatchesServer).toBe(true);
    expect(view.lastFailure).toEqual({ reasonCode: "retryable_server_failure", source: "server", verdict: "REJECTED", category: "assessment_attempt", at: "2026-09-25T11:00:00.000Z" });
    expect(view.operations.find((op) => op.operationId === "op-a")).toMatchObject({ serverReceived: true, serverVerdict: "REJECTED" });
    expect(view.operations.find((op) => op.operationId === "op-b")).toMatchObject({ serverReceived: null, serverVerdict: null });
  });
});

describe("no write authority", () => {
  it("the support service and route contain no mutation other than the audit record", () => {
    const service = readFileSync("lib/support/learnerSyncDiagnostics.ts", "utf8");
    expect(service).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/);
    const route = readFileSync("app/api/admin/support/learners/[learnerId]/sync-diagnostics/route.ts", "utf8");
    expect(route).not.toMatch(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/);
    expect(route).toContain("route-policy: auth=session; scope=tenant;");
  });

  it("the device reporter only reads the queue", () => {
    const reporter = readFileSync("lib/offline/syncDiagnosticsReporter.ts", "utf8");
    const imports = reporter.match(/import \{([^}]+)\} from "@\/lib\/offline-queue"/)?.[1].split(",").map((s) => s.trim());
    expect(imports).toEqual(["getQueue"]);
  });
});
