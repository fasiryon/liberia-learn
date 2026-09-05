import { prisma } from "@/lib/db";
import { getEnvironment } from "@/lib/environment";
import { getSystemHealth } from "@/lib/ops/healthCheck";
import { getQueueDepths } from "@/lib/ops/queueDepths";
import { isP2bReviewOperationsEnabled, isP2cCurriculumBenchmarkingEnabled } from "@/lib/serverFlags";
import type { OperationalPanel, OperationalScope, OperationalSourceReaders, OperationalStatus, Provenance } from "@/lib/ops/operationalSnapshot";

const FRESH_FOR_MS = 5 * 60_000;

function provenance(scope: OperationalScope, now: Date, sourceSubsystem: string, definitionVersion: string, sourceTimestamp: Date | string | null): Provenance {
  const timestamp = sourceTimestamp instanceof Date ? sourceTimestamp.toISOString() : sourceTimestamp;
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  const age = now.getTime() - parsed;
  return { sourceSubsystem, definitionVersion, sourceTimestamp: timestamp, generatedAt: now.toISOString(), scope, freshness: !timestamp || !Number.isFinite(parsed) ? "UNKNOWN" : age > FRESH_FOR_MS ? "STALE" : "FRESH" };
}

function panel<T>(scope: OperationalScope, now: Date, source: string, version: string, status: OperationalStatus, data: T, sourceTimestamp: Date | string | null = now): OperationalPanel<T> {
  const sourceProvenance = provenance(scope, now, source, version, sourceTimestamp);
  return { status: sourceProvenance.freshness === "STALE" && status === "HEALTHY" ? "DEGRADED" : status, data, provenance: sourceProvenance };
}

function metricValue(payload: unknown, key = "count"): number | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function readLatestOfflineMetric(name: string, scope: OperationalScope, since: Date) {
  return prisma.metricEvent.findFirst({
    where: { name, createdAt: { gte: since }, ...(scope.kind === "SCHOOL" ? { schoolId: scope.schoolId } : {}) },
    select: { payloadJson: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export const operationalSourceReaders: OperationalSourceReaders = {
  async system({ scope, now }) {
    const health = await getSystemHealth();
    const status: OperationalStatus = health.db.status === "down" ? "BLOCKED" : health.db.status === "degraded" || health.redis.status === "down" ? "DEGRADED" : health.redis.status === "unconfigured" ? "UNKNOWN" : "HEALTHY";
    return panel(scope, now, "lib/ops/healthCheck.ts", "health-v1", status, {
      database: health.db.status,
      databaseLatencyMs: health.db.latencyMs,
      redis: health.redis.status,
      redisLatencyMs: health.redis.latencyMs,
      runtime: status,
      version: process.env.npm_package_version ?? "1.0.0",
      commitSha: health.deployment.commitSha,
      environment: getEnvironment(),
      notificationProvider: "NONE",
      sentryConfigured: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim()),
    }, health.timestamp);
  },

  async queues({ scope, now }) {
    if (scope.kind === "SCHOOL") return panel(scope, now, "AWS SQS aggregate", "queue-v1", "UNKNOWN", { pending: null, processing: null, retrying: null, dlq: null, failed: null, unknownJobs: null, oldestQueuedAt: null, workerAvailability: "NOT_EXPOSED_AT_SCHOOL_SCOPE" }, null);
    const queues = await getQueueDepths();
    const unknown = !queues.mainQueue.configured || queues.mainQueue.depth === null || !queues.dlq.configured || queues.dlq.depth === null;
    const status: OperationalStatus = (queues.dlq.depth ?? 0) > 0 ? "BLOCKED" : unknown ? "UNKNOWN" : "HEALTHY";
    return panel(scope, now, "lib/ops/queueDepths.ts and AWS SQS", "queue-v1", status, { pending: queues.mainQueue.depth, processing: queues.mainQueue.processing, retrying: queues.mainQueue.delayed, dlq: queues.dlq.depth, failed: null, unknownJobs: null, oldestQueuedAt: null, workerAvailability: "UNKNOWN" }, queues.observedAt);
  },

  async offline({ scope, now }) {
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    const names = ["offline.queue.pending", "offline.queue.retrying", "offline.queue.auth_held", "offline.queue.conflicts", "offline.queue.dead_letter", "offline.queue.isolation_failure"];
    const rows = await Promise.all(names.map((name) => readLatestOfflineMetric(name, scope, since)));
    const values = rows.map((row) => metricValue(row?.payloadJson));
    const latest = rows.reduce<Date | null>((result, row) => !row ? result : !result || row.createdAt > result ? row.createdAt : result, null);
    const hasEvidence = rows.some(Boolean);
    const failures = (values[3] ?? 0) + (values[4] ?? 0) + (values[5] ?? 0);
    return panel(scope, now, "MetricEvent offline queue telemetry", "offline-metrics-v1", !hasEvidence ? "UNKNOWN" : failures > 0 ? "DEGRADED" : "HEALTHY", { queued: values[0], retrying: values[1], authHeld: values[2], conflicts: values[3], deadLetter: values[4], oldestUnsyncedAt: null, isolationFailures: values[5] }, latest);
  },

  async curriculum({ scope, now }) {
    const schoolWhere = scope.kind === "SCHOOL" ? { schoolId: scope.schoolId } : {};
    const taskWhere = scope.kind === "SCHOOL" ? { schoolId: scope.schoolId } : {};
    const [pendingReview, highRiskReview, staleReview, revokedContent, unverifiedContent] = await Promise.all([
      prisma.curriculumReviewTask.count({ where: { ...taskWhere, status: { in: ["QUEUED", "CLAIMED", "IN_REVIEW", "AWAITING_SECOND_REVIEW", "DISAGREEMENT", "ESCALATED"] } } }),
      prisma.curriculumReviewTask.count({ where: { ...taskWhere, priorityBand: { in: ["CRITICAL", "HIGH"] }, status: { notIn: ["COMPLETED", "CANCELLED", "EXPIRED"] } } }),
      prisma.curriculumReviewTask.count({ where: { ...taskWhere, dueAt: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED", "EXPIRED"] } } }),
      prisma.curriculumContent.count({ where: { ...schoolWhere, status: "REVOKED" } }),
      prisma.curriculumContent.count({ where: { ...schoolWhere, OR: [{ status: { in: ["DRAFT", "NEEDS_REVIEW", "PENDING_REVIEW"] } }, { provenance: { provenanceCompleteness: "UNVERIFIED" } }] } }),
    ]);
    const status: OperationalStatus = highRiskReview > 0 || staleReview > 0 ? "DEGRADED" : "HEALTHY";
    return panel(scope, now, "P2-A/P2-B curriculum governance projections", "curriculum-review-policy-versioned", status, { pendingReview, highRiskReview, staleReview, revisionNeeded: null, revokedContent, governanceEnabled: isP2cCurriculumBenchmarkingEnabled(), unverifiedContent, reviewerActivation: isP2bReviewOperationsEnabled() ? "UNKNOWN" : "NOT_CONFIGURED" });
  },

  async aiQuality({ scope, now }) {
    return panel(scope, now, "P7-A governed measurement", "metric-v2", "UNKNOWN", { metricVersion: 2, tutorHelpfulness: null, grounding: null, hallucination: null, moderationFalsePositive: null, moderationFalseNegative: null, evidenceState: "NOT_PERSISTED" }, null);
  },

  async experiments({ scope, now }) {
    return panel(scope, now, "P7-B controlled experiment runtime", "experiment-contract-v1", "UNKNOWN", { running: null, pausedOrStopped: null, srm: "UNKNOWN", guardrailBreaches: null, earlyStop: "UNKNOWN", assignments: null, exposures: null, insufficientData: null, conflicts: null }, null);
  },

  async qualityOperations({ scope, now }) {
    const schoolWhere = scope.kind === "SCHOOL" ? { schoolId: scope.schoolId } : {};
    const [openReviewTasks, staleReviewTasks, calibrationOpen] = await Promise.all([
      prisma.qualityReviewTask.count({ where: { ...schoolWhere, status: { in: ["QUEUED", "CLAIMED"] } } }),
      prisma.qualityReviewTask.count({ where: { ...schoolWhere, dueAt: { lt: now }, status: { in: ["QUEUED", "CLAIMED"] } } }),
      prisma.qualityReviewCalibrationSession.count({ where: { status: "OPEN", ...(scope.kind === "SCHOOL" ? { referenceTask: { schoolId: scope.schoolId } } : {}) } }),
    ]);
    return panel(scope, now, "P7-C quality operations", "release-gate-v1", staleReviewTasks > 0 ? "DEGRADED" : "UNKNOWN", { releaseGate: "UNKNOWN", openReviewTasks, staleReviewTasks, calibration: calibrationOpen > 0 ? "VERIFIED" : "PENDING", openIncidents: null, rollbackSignal: null, hardSafetyBlocks: null, moderationRegression: null });
  },

  async incidents({ scope, now }) {
    if (scope.kind === "SCHOOL") return panel(scope, now, "existing incident authorities", "incident-reference-v1", "UNKNOWN", { open: [] }, null);
    const rows = await prisma.escalationQueue.findMany({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true, priority: true, agentName: true, assignedTo: true, createdAt: true, reason: true }, orderBy: { createdAt: "asc" }, take: 100 });
    return panel(scope, now, "EscalationQueue plus P7-C incident authority", "incident-reference-v1", rows.some((row) => row.priority === "HIGH") ? "DEGRADED" : "HEALTHY", { open: rows.map((row) => ({ id: row.id, severity: row.priority, subsystem: row.agentName, owner: row.assignedTo, detectedAt: row.createdAt.toISOString(), evidenceRef: `escalation:${row.id}`, blocksReadiness: row.priority === "HIGH" })) });
  },

  async tenants({ scope, now }) {
    if (scope.kind === "SCHOOL") {
      const school = await prisma.school.findUnique({ where: { id: scope.schoolId }, select: { status: true } });
      return panel(scope, now, "School tenant authority", "school-status-v1", !school ? "UNKNOWN" : school.status === "ACTIVE" ? "HEALTHY" : "DEGRADED", { activeSchools: school?.status === "ACTIVE" ? 1 : 0, inactiveSchools: school && school.status !== "ACTIVE" ? 1 : 0, scopedSchoolStatus: school?.status ?? null, isolationFailures: 0 });
    }
    const [activeSchools, inactiveSchools, isolationFailures] = await Promise.all([
      prisma.school.count({ where: { status: "ACTIVE" } }),
      prisma.school.count({ where: { status: { not: "ACTIVE" } } }),
      prisma.metricEvent.count({ where: { name: "security.tenant_isolation_failure", createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60_000) } } }),
    ]);
    return panel(scope, now, "School tenant authority and security telemetry", "tenant-health-v1", isolationFailures > 0 ? "BLOCKED" : "HEALTHY", { activeSchools, inactiveSchools, scopedSchoolStatus: null, isolationFailures });
  },
};


