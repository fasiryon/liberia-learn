import { prisma } from "@/lib/db";
import { logAudit, logAuditRequired } from "@/lib/audit";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";
import {
  SYNC_DIAGNOSTIC_SNAPSHOT_METRIC,
  SYNC_RESULT_METRIC,
  deriveSyncDiagnosticStates,
  sanitizeServerSyncOutcomes,
  sanitizeSyncDiagnosticSnapshot,
  type ServerVerdict,
  type SyncDiagnosticCounts,
  type SyncDiagnosticSnapshot,
  type SyncDiagnosticState,
  type SyncOperationCategory,
  type TimedServerOutcome,
  type UnacknowledgedQueueState,
} from "@/lib/offline/syncDiagnosticsContract";

export const SYNC_DIAGNOSTICS_WINDOW_DAYS = 30;
const MAX_EVIDENCE_ROWS = 100;
const MAX_RECENT_OUTCOMES = 20;
const LEARNER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export type SupportViewer = {
  id: string;
  role: string;
  schoolId?: string | null;
  isPlatformAdmin?: boolean;
};

type Db = {
  user: { findUnique(args: any): Promise<{ id: string; name: string | null; role: string; schoolId: string | null } | null> };
  metricEvent: { findMany(args: any): Promise<Array<{ name: string; payloadJson: unknown; createdAt: Date }>> };
};

export class SyncDiagnosticsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * The complete support-facing contract. Every field is either diagnostic
 * bookkeeping or null when unavailable; null is never rendered as zero.
 * Answers, answer keys, operation payloads, lesson content, messages,
 * guardian data, and mastery internals have no field here by construction.
 */
export type LearnerSyncDiagnosticsView = {
  learner: { id: string; displayName: string | null };
  generatedAt: string;
  windowDays: number;
  primaryState: SyncDiagnosticState;
  activeStates: SyncDiagnosticState[];
  lastSuccessfulSyncAt: string | null;
  lastServerContactAt: string | null;
  device: {
    reportedAt: string | null;
    capturedAt: string | null;
    stale: boolean | null;
    online: boolean | null;
    clientVersion: string | null;
    protocolVersion: number | null;
  };
  release: {
    appRelease: string | null;
    serverRelease: string | null;
    appReleaseMatchesServer: boolean | null;
    queuedReleaseSequence: { revision: number; governance: number } | null;
  };
  queue: {
    counts: SyncDiagnosticCounts | null;
    categories: Partial<Record<SyncOperationCategory, number>> | null;
    oldestPendingAgeSeconds: number | null;
    maxRetryCount: number | null;
    nextRetryInSeconds: number | null;
    reasonCodes: Record<string, number> | null;
  };
  lastFailure: {
    reasonCode: string;
    source: "server" | "device";
    verdict: ServerVerdict | null;
    category: SyncOperationCategory;
    at: string | null;
  } | null;
  operations: Array<{
    operationId: string;
    category: SyncOperationCategory;
    queueState: UnacknowledgedQueueState;
    reasonCode: string | null;
    ageSeconds: number | null;
    retryCount: number;
    /** null: no server evidence in the window, which is not proof of absence. */
    serverReceived: boolean | null;
    serverVerdict: ServerVerdict | null;
  }>;
  recentServerOutcomes: Array<{
    operationId: string | null;
    category: SyncOperationCategory;
    verdict: ServerVerdict;
    reasonCode: string | null;
    at: string;
  }>;
};

async function deny(viewer: SupportViewer, learnerId: string, reason: string): Promise<never> {
  await logAudit({
    userId: viewer.id,
    action: "support.sync_diagnostics.denied",
    resourceType: "User",
    resourceId: learnerId.slice(0, 64),
    schoolId: viewer.schoolId ?? null,
    details: { reason },
  });
  // One response for missing, non-learner, and other-school targets so the
  // endpoint cannot be used to probe which learners exist elsewhere.
  throw new SyncDiagnosticsError("Learner not found", 404);
}

function legacySynced(payload: unknown): boolean {
  const synced = (payload as { synced?: unknown } | null)?.synced;
  return typeof synced === "number" && synced > 0;
}

/**
 * Read-only support diagnostics for one learner. Fails closed on missing
 * capability, school context, tenant mismatch, or audit failure. Performs no
 * write other than the audit record of the read itself.
 */
export async function readLearnerSyncDiagnostics(
  viewer: SupportViewer,
  learnerId: string,
  options: { now?: Date; db?: Db; audit?: typeof logAuditRequired; serverRelease?: string | null } = {},
): Promise<LearnerSyncDiagnosticsView> {
  const db = options.db ?? (prisma as unknown as Db);
  const audit = options.audit ?? logAuditRequired;
  const now = options.now ?? new Date();

  if (!hasPermission(viewer, PERMISSIONS.SUPPORT_SYNC_DIAGNOSTICS_READ)) {
    throw new SyncDiagnosticsError("Forbidden", 403);
  }
  if (!viewer.isPlatformAdmin && !viewer.schoolId) {
    throw new SyncDiagnosticsError("School context required", 403);
  }
  if (!LEARNER_ID.test(learnerId)) return deny(viewer, learnerId, "invalid_learner_id");

  const learner = await db.user.findUnique({
    where: { id: learnerId },
    select: { id: true, name: true, role: true, schoolId: true },
  });
  if (!learner || learner.role !== "STUDENT") return deny(viewer, learnerId, "not_a_learner");
  if (!viewer.isPlatformAdmin && learner.schoolId !== viewer.schoolId) {
    return deny(viewer, learnerId, "cross_tenant");
  }

  const since = new Date(now.getTime() - SYNC_DIAGNOSTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = await db.metricEvent.findMany({
    where: {
      userId: learner.id,
      // Evidence recorded under the learner's current school only.
      schoolId: learner.schoolId,
      name: { in: [SYNC_DIAGNOSTIC_SNAPSHOT_METRIC, SYNC_RESULT_METRIC] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_EVIDENCE_ROWS,
    select: { name: true, payloadJson: true, createdAt: true },
  });

  let snapshot: SyncDiagnosticSnapshot | null = null;
  let snapshotReceivedAt: Date | null = null;
  let lastSuccessfulSyncAt: Date | null = null;
  const outcomes: TimedServerOutcome[] = [];
  for (const row of rows) {
    if (row.name === SYNC_DIAGNOSTIC_SNAPSHOT_METRIC) {
      if (snapshot) continue;
      snapshot = sanitizeSyncDiagnosticSnapshot(row.payloadJson);
      if (snapshot) snapshotReceivedAt = row.createdAt;
      continue;
    }
    const rowOutcomes = sanitizeServerSyncOutcomes((row.payloadJson as { outcomes?: unknown } | null)?.outcomes)
      .map((outcome) => ({ ...outcome, receivedAt: row.createdAt.toISOString() }));
    outcomes.push(...rowOutcomes);
    const accepted = rowOutcomes.some((o) => o.verdict === "ACCEPTED" || o.verdict === "ALREADY_RECEIVED");
    if (!lastSuccessfulSyncAt && (accepted || legacySynced(row.payloadJson))) lastSuccessfulSyncAt = row.createdAt;
  }

  const latestByOperation = new Map<string, TimedServerOutcome>();
  for (const outcome of outcomes) {
    if (outcome.operationId && !latestByOperation.has(outcome.operationId)) latestByOperation.set(outcome.operationId, outcome);
  }

  const derived = deriveSyncDiagnosticStates({ snapshot, snapshotReceivedAt, outcomes, now });
  const serverFailure = outcomes.find((o) => (o.verdict === "REJECTED" || o.verdict === "CONFLICT") && o.reasonCode);
  const deviceFailure = snapshot?.operations.find((op) => op.reasonCode);
  const lastFailure = serverFailure
    ? { reasonCode: serverFailure.reasonCode!, source: "server" as const, verdict: serverFailure.verdict, category: serverFailure.category, at: serverFailure.receivedAt }
    : deviceFailure
      ? { reasonCode: deviceFailure.reasonCode!, source: "device" as const, verdict: null, category: deviceFailure.category, at: snapshot!.capturedAt }
      : null;

  const serverRelease = options.serverRelease !== undefined
    ? options.serverRelease
    : process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null;
  const appRelease = snapshot?.appRelease ?? null;

  const view: LearnerSyncDiagnosticsView = {
    learner: { id: learner.id, displayName: learner.name },
    generatedAt: now.toISOString(),
    windowDays: SYNC_DIAGNOSTICS_WINDOW_DAYS,
    primaryState: derived.primaryState,
    activeStates: derived.activeStates,
    lastSuccessfulSyncAt: lastSuccessfulSyncAt?.toISOString() ?? null,
    lastServerContactAt: rows[0]?.createdAt.toISOString() ?? null,
    device: {
      reportedAt: snapshotReceivedAt?.toISOString() ?? null,
      capturedAt: snapshot?.capturedAt ?? null,
      stale: derived.snapshotStale,
      online: snapshot?.online ?? null,
      clientVersion: snapshot?.clientVersion ?? null,
      protocolVersion: snapshot?.protocolVersion ?? null,
    },
    release: {
      appRelease,
      serverRelease,
      appReleaseMatchesServer: appRelease && serverRelease ? appRelease === serverRelease : null,
      queuedReleaseSequence: snapshot?.releaseSequence ?? null,
    },
    queue: {
      counts: snapshot?.counts ?? null,
      categories: snapshot?.categories ?? null,
      oldestPendingAgeSeconds: snapshot?.oldestPendingAgeSeconds ?? null,
      maxRetryCount: snapshot?.maxRetryCount ?? null,
      nextRetryInSeconds: snapshot?.nextRetryInSeconds ?? null,
      reasonCodes: snapshot?.reasonCodes ?? null,
    },
    lastFailure,
    operations: (snapshot?.operations ?? []).map((op) => {
      const outcome = latestByOperation.get(op.operationId);
      return {
        operationId: op.operationId,
        category: op.category,
        queueState: op.queueState,
        reasonCode: op.reasonCode,
        ageSeconds: op.ageSeconds,
        retryCount: op.retryCount,
        serverReceived: outcome ? true : null,
        serverVerdict: outcome?.verdict ?? null,
      };
    }),
    recentServerOutcomes: outcomes.slice(0, MAX_RECENT_OUTCOMES).map((o) => ({
      operationId: o.operationId,
      category: o.category,
      verdict: o.verdict,
      reasonCode: o.reasonCode,
      at: o.receivedAt,
    })),
  };

  // Sensitive support read: no durable audit record, no data.
  try {
    await audit({
      userId: viewer.id,
      action: "support.sync_diagnostics.viewed",
      resourceType: "User",
      resourceId: learner.id,
      schoolId: learner.schoolId,
      details: {
        primaryState: view.primaryState,
        viewerRole: viewer.role,
        platformAdmin: viewer.isPlatformAdmin === true,
      },
    });
  } catch {
    throw new SyncDiagnosticsError("Diagnostics unavailable: audit could not be recorded", 503);
  }
  return view;
}
