import { createHash } from "crypto";

export type OperationalAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type OperationalAlertState = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export type OperationalAlertDefinition = {
  alertId: string;
  version: number;
  source: string;
  severity: OperationalAlertSeverity;
  condition: string;
  window: string;
  minimumEvidence: string;
  fingerprintTemplate: "alertId:version:scopeKey";
  cooldownMinutes: number;
  owner: string;
  recommendedAction: string;
};

export type AlertObservation = {
  definition: OperationalAlertDefinition;
  active: boolean;
  scopeKey: string;
  observedAt: string;
  evidence: Record<string, string | number | boolean | null>;
};

export type OperationalAlert = {
  alertId: string;
  definitionVersion: number;
  fingerprint: string;
  source: string;
  severity: OperationalAlertSeverity;
  state: OperationalAlertState;
  scopeKey: string;
  owner: string;
  recommendedAction: string;
  openedAt: string;
  lastObservedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  observations: number;
  evidence: AlertObservation["evidence"];
};

export const OPERATIONAL_ALERT_DEFINITIONS = {
  runtimeDown: { alertId: "runtime-health-failure", version: 1, source: "runtime health", severity: "CRITICAL", condition: "authoritative runtime status is BLOCKED", window: "current snapshot", minimumEvidence: "one failed critical dependency check", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 15, owner: "Platform Operations", recommendedAction: "Follow the runtime incident runbook and verify database connectivity." },
  queueDlq: { alertId: "queue-dlq-nonempty", version: 1, source: "worker queue", severity: "CRITICAL", condition: "DLQ count is greater than zero", window: "current snapshot", minimumEvidence: "one authoritative SQS observation", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 30, owner: "Platform Operations", recommendedAction: "Inspect DLQ entries, including unknown and unimplemented job types; do not acknowledge them as success." },
  queueAge: { alertId: "queue-oldest-over-15m", version: 1, source: "worker queue", severity: "WARNING", condition: "oldest queued job is older than 15 minutes", window: "15 minutes", minimumEvidence: "one authoritative queue-age observation", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 30, owner: "Platform Operations", recommendedAction: "Check worker capacity, retry volume, and queue drain rate." },
  offlineFailure: { alertId: "offline-sync-failure", version: 1, source: "offline synchronization", severity: "WARNING", condition: "conflict or dead-letter evidence is present", window: "snapshot source window", minimumEvidence: "one tenant-scoped aggregate event", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 30, owner: "Learner Platform", recommendedAction: "Inspect aggregate sync failure categories without exposing learner content." },
  qualityBlock: { alertId: "quality-release-block", version: 1, source: "P7-C quality operations", severity: "CRITICAL", condition: "P7-C release gate result is BLOCK", window: "current P7-C evaluation", minimumEvidence: "one versioned release-gate result", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 60, owner: "AI Quality", recommendedAction: "Keep release blocked and follow the linked quality evidence and rollback signal." },
  experimentStop: { alertId: "experiment-stop-signal", version: 1, source: "P7-B controlled experiments", severity: "CRITICAL", condition: "SRM, guardrail breach, or early-stop signal is present", window: "current experiment analysis", minimumEvidence: "one versioned P7-B analysis", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 60, owner: "Experiment Owner", recommendedAction: "Pause exposure and obtain authorized experiment review." },
  staleReview: { alertId: "review-sla-breached", version: 1, source: "curriculum and quality review", severity: "WARNING", condition: "one or more open review tasks are past due", window: "current review queue", minimumEvidence: "one dueAt timestamp before snapshot time", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 60, owner: "Review Operations", recommendedAction: "Assign qualified reviewers and triage highest-risk overdue work first." },
  queueBacklog: { alertId: "queue-backlog", version: 1, source: "worker queue", severity: "WARNING", condition: "the queue authority reports a backlog breach", window: "authority-defined", minimumEvidence: "one authoritative backlog-breach observation", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 30, owner: "Platform Operations", recommendedAction: "Check worker capacity and the queue drain trend before changing capacity." },
  dlqGrowth: { alertId: "queue-dlq-growth", version: 1, source: "worker queue", severity: "CRITICAL", condition: "the queue authority reports DLQ growth", window: "authority-defined", minimumEvidence: "two comparable authoritative DLQ observations", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 30, owner: "Platform Operations", recommendedAction: "Inspect new DLQ entries and preserve the failed-job evidence." },
  moderationRegression: { alertId: "moderation-regression", version: 1, source: "P7-C quality operations", severity: "CRITICAL", condition: "P7-C reports a critical moderation regression", window: "current P7-C evaluation", minimumEvidence: "one versioned P7-C regression result", fingerprintTemplate: "alertId:version:scopeKey", cooldownMinutes: 60, owner: "Safeguarding and AI Quality", recommendedAction: "Keep the affected release blocked and escalate through the safeguarding runbook." },
} as const satisfies Record<string, OperationalAlertDefinition>;

export function operationalAlertFingerprint(definition: OperationalAlertDefinition, scopeKey: string): string {
  return createHash("sha256").update(`${definition.alertId}:${definition.version}:${scopeKey}`).digest("hex");
}

export function reconcileOperationalAlerts(previous: OperationalAlert[], observations: AlertObservation[]): OperationalAlert[] {
  const byFingerprint = new Map(previous.map((alert) => [alert.fingerprint, alert]));
  const observed = new Set<string>();
  const next: OperationalAlert[] = [];
  for (const item of observations) {
    const fingerprint = operationalAlertFingerprint(item.definition, item.scopeKey);
    const existing = byFingerprint.get(fingerprint);
    if (!item.active) {
      if (existing && existing.state !== "RESOLVED") {
        next.push({ ...existing, state: "RESOLVED", resolvedAt: item.observedAt });
      }
      observed.add(fingerprint);
      continue;
    }
    observed.add(fingerprint);
    next.push(existing && existing.state !== "RESOLVED" ? {
      ...existing,
      lastObservedAt: item.observedAt,
      observations: existing.observations + 1,
      evidence: item.evidence,
    } : {
      alertId: item.definition.alertId,
      definitionVersion: item.definition.version,
      fingerprint,
      source: item.definition.source,
      severity: item.definition.severity,
      state: "OPEN",
      scopeKey: item.scopeKey,
      owner: item.definition.owner,
      recommendedAction: item.definition.recommendedAction,
      openedAt: item.observedAt,
      lastObservedAt: item.observedAt,
      observations: 1,
      evidence: item.evidence,
    });
  }
  for (const alert of previous) {
    if (observed.has(alert.fingerprint) || alert.state === "RESOLVED") continue;
    next.push({ ...alert, state: "RESOLVED", resolvedAt: observations[0]?.observedAt ?? alert.lastObservedAt });
  }
  return next.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export function acknowledgeOperationalAlert(alert: OperationalAlert, at: string): OperationalAlert {
  if (alert.state === "RESOLVED") return alert;
  return { ...alert, state: "ACKNOWLEDGED", acknowledgedAt: at };
}

export function resolveOperationalAlert(alert: OperationalAlert, at: string): OperationalAlert {
  if (alert.state === "RESOLVED") return alert;
  return { ...alert, state: "RESOLVED", resolvedAt: at };
}

export type OperationalNotificationAdapter = {
  name: string;
  configured: boolean;
  notify(alert: OperationalAlert): Promise<{ delivered: boolean; externalId?: string }>;
};

export const noOpOperationalNotificationAdapter: OperationalNotificationAdapter = {
  name: "none",
  configured: false,
  async notify() { return { delivered: false }; },
};


