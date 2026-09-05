import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth";
import { resolveOperationalScope } from "@/lib/ops/access";
import {
  acknowledgeOperationalAlert,
  noOpOperationalNotificationAdapter,
  OPERATIONAL_ALERT_DEFINITIONS,
  operationalAlertFingerprint,
  reconcileOperationalAlerts,
  resolveOperationalAlert,
} from "@/lib/ops/operationalAlerts";
import {
  EXTERNAL_READINESS_GATES,
  getOperationalSnapshot,
  OPERATIONAL_SNAPSHOT_VERSION,
  P7_PROVENANCE,
  type OperationalPanel,
  type OperationalScope,
  type OperationalSourceReaders,
  type OperationalStatus,
  type SnapshotPanels,
} from "@/lib/ops/operationalSnapshot";

const NOW = "2026-09-04T12:00:00.000Z";
const SCOPE: OperationalScope = { kind: "SCHOOL", schoolId: "school-a" };

function panel<T>(data: T, status: OperationalStatus = "HEALTHY", freshness: "FRESH" | "STALE" | "UNKNOWN" = "FRESH"): OperationalPanel<T> {
  return { status, data, provenance: { sourceSubsystem: "authoritative fixture", definitionVersion: "fixture-v1", sourceTimestamp: freshness === "UNKNOWN" ? null : freshness === "STALE" ? "2026-09-04T10:00:00.000Z" : NOW, generatedAt: NOW, scope: SCOPE, freshness } };
}

function basePanels(): SnapshotPanels {
  return {
    system: panel({ database: "healthy", databaseLatencyMs: 12, redis: "healthy", redisLatencyMs: 8, runtime: "HEALTHY", version: "1.0.0", commitSha: "abc123", environment: "test", notificationProvider: "NONE", sentryConfigured: true }),
    queues: panel({ pending: 0, processing: 0, retrying: 0, dlq: 0, failed: 0, unknownJobs: 0, oldestQueuedAt: null, workerAvailability: "AVAILABLE" }),
    offline: panel({ queued: 0, retrying: 0, authHeld: 0, conflicts: 0, deadLetter: 0, oldestUnsyncedAt: null, isolationFailures: 0 }),
    curriculum: panel({ pendingReview: 0, highRiskReview: 0, staleReview: 0, revisionNeeded: 0, revokedContent: 0, governanceEnabled: true, unverifiedContent: 0, reviewerActivation: "VERIFIED" }),
    aiQuality: panel({ metricVersion: 2, tutorHelpfulness: 0.91, grounding: 0.98, hallucination: 0.01, moderationFalsePositive: 0.02, moderationFalseNegative: 0, evidenceState: "AVAILABLE" }),
    experiments: panel({ running: 1, pausedOrStopped: 0, srm: "CLEAR", guardrailBreaches: 0, earlyStop: "CONTINUE", assignments: 100, exposures: 97, insufficientData: false, conflicts: 0 }),
    qualityOperations: panel({ releaseGate: "PASS", openReviewTasks: 0, staleReviewTasks: 0, calibration: "VERIFIED", openIncidents: 0, rollbackSignal: false, hardSafetyBlocks: 0, moderationRegression: false }),
    incidents: panel({ open: [] }),
    tenants: panel({ activeSchools: 1, inactiveSchools: 0, scopedSchoolStatus: "ACTIVE", isolationFailures: 0 }),
  };
}

function readers(panels: SnapshotPanels): OperationalSourceReaders {
  return {
    system: async () => panels.system,
    queues: async () => panels.queues,
    offline: async () => panels.offline,
    curriculum: async () => panels.curriculum,
    aiQuality: async () => panels.aiQuality,
    experiments: async () => panels.experiments,
    qualityOperations: async () => panels.qualityOperations,
    incidents: async () => panels.incidents,
    tenants: async () => panels.tenants,
  };
}

async function snapshot(panels = basePanels()) {
  return getOperationalSnapshot({ scope: SCOPE, readers: readers(panels), now: new Date(NOW), readinessGates: [{ id: "fixture", label: "Fixture", state: "VERIFIED", evidence: "fixture" }] });
}

describe("NR-15 operational snapshot", () => {
  it("returns a versioned healthy snapshot when every authority is fresh and healthy", async () => {
    const result = await snapshot();
    expect(result.version).toBe(OPERATIONAL_SNAPSHOT_VERSION);
    expect(result.status).toBe("HEALTHY");
    expect(result.alerts).toHaveLength(0);
  });

  it("propagates degraded queue state and creates backlog and age alerts", async () => {
    const panels = basePanels();
    panels.queues = panel({ ...panels.queues.data!, pending: 40, oldestQueuedAt: "2026-09-04T11:30:00.000Z" }, "DEGRADED");
    const result = await snapshot(panels);
    expect(result.status).toBe("DEGRADED");
    expect(result.alerts.map((alert) => alert.alertId)).toEqual(expect.arrayContaining(["queue-backlog", "queue-oldest-over-15m"]));
  });

  it("propagates runtime and quality hard blocks", async () => {
    const panels = basePanels();
    panels.system = panel(panels.system.data!, "BLOCKED");
    panels.qualityOperations = panel({ ...panels.qualityOperations.data!, releaseGate: "BLOCK", rollbackSignal: true, hardSafetyBlocks: 1 }, "BLOCKED");
    const result = await snapshot(panels);
    expect(result.status).toBe("BLOCKED");
    expect(result.alerts.map((alert) => alert.alertId)).toEqual(expect.arrayContaining(["runtime-health-failure", "quality-release-block"]));
  });

  it("keeps missing data unknown instead of healthy", async () => {
    const panels = basePanels();
    panels.aiQuality = panel({ ...panels.aiQuality.data!, tutorHelpfulness: null, evidenceState: "NOT_PERSISTED" }, "UNKNOWN", "UNKNOWN");
    expect((await snapshot(panels)).status).toBe("UNKNOWN");
  });

  it("marks stale healthy evidence degraded", async () => {
    const panels = basePanels();
    panels.offline = panel(panels.offline.data!, "HEALTHY", "STALE");
    const result = await snapshot(panels);
    expect(result.panels.offline.status).toBe("DEGRADED");
    expect(result.status).toBe("DEGRADED");
  });

  it("isolates one source failure and preserves other panels", async () => {
    const sourceReaders = readers(basePanels());
    sourceReaders.experiments = async () => { throw new Error("provider detail that must not leak"); };
    const result = await getOperationalSnapshot({ scope: SCOPE, readers: sourceReaders, now: new Date(NOW), readinessGates: [] });
    expect(result.panels.experiments).toMatchObject({ status: "UNKNOWN", data: null, error: "SOURCE_UNAVAILABLE" });
    expect(result.panels.system.status).toBe("HEALTHY");
    expect(JSON.stringify(result)).not.toContain("provider detail");
  });

  it("surfaces queue, offline, quality, experiment, review, and incident authority values", async () => {
    const panels = basePanels();
    panels.incidents = panel({ open: [{ id: "inc-1", severity: "HIGH", subsystem: "safeguarding", owner: "Safety", detectedAt: NOW, evidenceRef: "quality:inc-1", blocksReadiness: true }] }, "DEGRADED");
    const result = await snapshot(panels);
    expect(result.panels.queues.data?.processing).toBe(0);
    expect(result.panels.offline.data?.authHeld).toBe(0);
    expect(result.panels.qualityOperations.data?.releaseGate).toBe("PASS");
    expect(result.panels.experiments.data?.assignments).toBe(100);
    expect(result.panels.curriculum.data?.pendingReview).toBe(0);
    expect(result.panels.incidents.data?.open[0].evidenceRef).toBe("quality:inc-1");
  });

  it("alerts on DLQ, offline failure, moderation regression, SRM, and stale reviews", async () => {
    const panels = basePanels();
    panels.queues = panel({ ...panels.queues.data!, dlq: 2 }, "BLOCKED");
    panels.offline = panel({ ...panels.offline.data!, deadLetter: 1 }, "DEGRADED");
    panels.qualityOperations = panel({ ...panels.qualityOperations.data!, moderationRegression: true }, "BLOCKED");
    panels.experiments = panel({ ...panels.experiments.data!, srm: "SRM_DETECTED", earlyStop: "STOP" }, "BLOCKED");
    panels.curriculum = panel({ ...panels.curriculum.data!, staleReview: 3 }, "DEGRADED");
    const ids = (await snapshot(panels)).alerts.map((alert) => alert.alertId);
    expect(ids).toEqual(expect.arrayContaining(["queue-dlq-nonempty", "offline-sync-failure", "moderation-regression", "experiment-stop-signal", "review-sla-breached"]));
  });

  it("contains provenance and privacy-safe aggregate output", async () => {
    const result = await snapshot();
    expect(result.panels.aiQuality.provenance.definitionVersion).toBe("fixture-v1");
    expect(result.scope).toEqual(SCOPE);
    expect(JSON.stringify(result)).not.toMatch(/learnerPrompt|assessmentResponse|safeguardingContent/);
    expect(P7_PROVENANCE).toMatchObject({ measurementMetricVersion: 2 });
  });

  it("keeps external gates and NR-13 promotion explicitly pending or unknown", () => {
    expect(EXTERNAL_READINESS_GATES.find((gate) => gate.id === "p7-migrations")?.state).toBe("UNKNOWN");
    expect(EXTERNAL_READINESS_GATES.find((gate) => gate.id === "nr13-promotion")?.state).toBe("PENDING");
    expect(EXTERNAL_READINESS_GATES.every((gate) => gate.evidence.length > 0)).toBe(true);
  });
});

describe("NR-15 alert lifecycle", () => {
  const definition = OPERATIONAL_ALERT_DEFINITIONS.queueDlq;
  const active = { definition, active: true, scopeKey: "school:school-a", observedAt: NOW, evidence: { dlq: 1 } };

  it("defines versioned alerts with owners, evidence, cooldown, and actions", () => {
    for (const item of Object.values(OPERATIONAL_ALERT_DEFINITIONS)) expect(item).toMatchObject({ version: 1, owner: expect.any(String), minimumEvidence: expect.any(String), recommendedAction: expect.any(String) });
  });

  it("uses deterministic tenant-bound fingerprints", () => {
    expect(operationalAlertFingerprint(definition, "school:a")).toBe(operationalAlertFingerprint(definition, "school:a"));
    expect(operationalAlertFingerprint(definition, "school:a")).not.toBe(operationalAlertFingerprint(definition, "school:b"));
  });

  it("deduplicates repeated observations and updates evidence", () => {
    const first = reconcileOperationalAlerts([], [active]);
    const second = reconcileOperationalAlerts(first, [{ ...active, observedAt: "2026-09-04T12:05:00.000Z", evidence: { dlq: 2 } }]);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ observations: 2, evidence: { dlq: 2 } });
  });

  it("acknowledges without destroying alert identity", () => {
    const alert = reconcileOperationalAlerts([], [active])[0];
    expect(acknowledgeOperationalAlert(alert, NOW)).toMatchObject({ fingerprint: alert.fingerprint, state: "ACKNOWLEDGED", acknowledgedAt: NOW });
  });

  it("resolves recovered conditions while retaining history", () => {
    const alert = reconcileOperationalAlerts([], [active])[0];
    const recovered = reconcileOperationalAlerts([alert], [{ ...active, active: false, observedAt: "2026-09-04T12:10:00.000Z", evidence: { dlq: 0 } }]);
    expect(recovered[0]).toMatchObject({ fingerprint: alert.fingerprint, state: "RESOLVED", observations: 1, resolvedAt: "2026-09-04T12:10:00.000Z" });
    expect(resolveOperationalAlert(alert, NOW).state).toBe("RESOLVED");
  });

  it("does not claim external notification delivery", async () => {
    const alert = reconcileOperationalAlerts([], [active])[0];
    expect(noOpOperationalNotificationAdapter.configured).toBe(false);
    expect(await noOpOperationalNotificationAdapter.notify(alert)).toEqual({ delivered: false });
  });
});

describe("NR-15 access boundary", () => {
  const user = (input: Partial<SessionUser>): SessionUser => ({ id: "u1", role: "ADMIN", schoolId: "school-a", ...input });

  it("authorizes a school admin only for their own school", () => {
    expect(resolveOperationalScope(user({}), new URLSearchParams())).toEqual({ kind: "SCHOOL", schoolId: "school-a" });
    expect(() => resolveOperationalScope(user({}), new URLSearchParams({ schoolId: "school-b" }))).toThrow("Forbidden");
  });

  it("rejects learner, teacher, and guardian dashboard access", () => {
    for (const role of ["STUDENT", "TEACHER", "GUARDIAN"] as const) expect(() => resolveOperationalScope(user({ role }), new URLSearchParams())).toThrow("Forbidden");
  });

  it("allows only platform or MOE super admins to request national aggregates", () => {
    expect(resolveOperationalScope(user({ isPlatformAdmin: true }), new URLSearchParams({ scope: "national" }))).toEqual({ kind: "NATIONAL" });
    expect(resolveOperationalScope(user({ role: "MOE_SUPER_ADMIN", schoolId: null }), new URLSearchParams({ scope: "national" }))).toEqual({ kind: "NATIONAL" });
    expect(() => resolveOperationalScope(user({}), new URLSearchParams({ scope: "national" }))).toThrow("Forbidden");
  });

  it("bounds and validates query parameters", () => {
    expect(() => resolveOperationalScope(user({}), new URLSearchParams({ scope: "planet" }))).toThrow("Invalid operational scope");
    expect(() => resolveOperationalScope(user({ isPlatformAdmin: true }), new URLSearchParams({ scope: "national", schoolId: "school-a" }))).toThrow("cannot be combined");
    expect(() => resolveOperationalScope(user({}), new URLSearchParams({ schoolId: "../school-b" }))).toThrow("Invalid schoolId");
  });
});


