import { GOVERNED_METRIC_VERSION } from "@/lib/measurement/governedMeasurement";
import type { OperationalAlert, AlertObservation } from "@/lib/ops/operationalAlerts";
import { OPERATIONAL_ALERT_DEFINITIONS, reconcileOperationalAlerts } from "@/lib/ops/operationalAlerts";

export const OPERATIONAL_SNAPSHOT_VERSION = 1 as const;
export type OperationalStatus = "HEALTHY" | "DEGRADED" | "BLOCKED" | "UNKNOWN";
export type ReadinessState = "VERIFIED" | "PENDING" | "NOT_CONFIGURED" | "UNKNOWN" | "BLOCKED";
export type OperationalScope = { kind: "SCHOOL"; schoolId: string } | { kind: "NATIONAL" };

export type Provenance = {
  sourceSubsystem: string;
  definitionVersion: string;
  sourceTimestamp: string | null;
  generatedAt: string;
  scope: OperationalScope;
  freshness: "FRESH" | "STALE" | "UNKNOWN";
};

export type OperationalPanel<T> = {
  status: OperationalStatus;
  data: T | null;
  error?: string;
  provenance: Provenance;
};

export type SystemHealthData = { database: string; databaseLatencyMs: number; redis: string; redisLatencyMs: number; runtime: string; version: string; commitSha: string; environment: string; notificationProvider: "NONE"; sentryConfigured: boolean };
export type QueueHealthData = { pending: number | null; processing: number | null; retrying: number | null; dlq: number | null; failed: number | null; unknownJobs: number | null; oldestQueuedAt: string | null; workerAvailability: string };
export type OfflineHealthData = { queued: number | null; retrying: number | null; authHeld: number | null; conflicts: number | null; deadLetter: number | null; oldestUnsyncedAt: string | null; isolationFailures: number | null };
export type CurriculumHealthData = { pendingReview: number; highRiskReview: number; staleReview: number; revisionNeeded: number | null; revokedContent: number; governanceEnabled: boolean; unverifiedContent: number; reviewerActivation: ReadinessState };
export type AiQualityData = { metricVersion: number; tutorHelpfulness: number | null; grounding: number | null; hallucination: number | null; moderationFalsePositive: number | null; moderationFalseNegative: number | null; evidenceState: "AVAILABLE" | "INSUFFICIENT" | "NOT_PERSISTED" };
export type ExperimentHealthData = { running: number | null; pausedOrStopped: number | null; srm: string; guardrailBreaches: number | null; earlyStop: string; assignments: number | null; exposures: number | null; insufficientData: boolean | null; conflicts: number | null };
export type QualityOperationsData = { releaseGate: "PASS" | "WARN" | "BLOCK" | "INSUFFICIENT_EVIDENCE" | "UNKNOWN"; openReviewTasks: number; staleReviewTasks: number; calibration: ReadinessState; openIncidents: number | null; rollbackSignal: boolean | null; hardSafetyBlocks: number | null; moderationRegression: boolean | null };
export type IncidentSummary = { id: string; severity: string; subsystem: string; owner: string | null; detectedAt: string; evidenceRef: string; blocksReadiness: boolean };
export type TenantHealthData = { activeSchools: number; inactiveSchools: number; scopedSchoolStatus: string | null; isolationFailures: number };
export type ReadinessGate = { id: string; label: string; state: ReadinessState; evidence: string };

export type SnapshotPanels = {
  system: OperationalPanel<SystemHealthData>;
  queues: OperationalPanel<QueueHealthData>;
  offline: OperationalPanel<OfflineHealthData>;
  curriculum: OperationalPanel<CurriculumHealthData>;
  aiQuality: OperationalPanel<AiQualityData>;
  experiments: OperationalPanel<ExperimentHealthData>;
  qualityOperations: OperationalPanel<QualityOperationsData>;
  incidents: OperationalPanel<{ open: IncidentSummary[] }>;
  tenants: OperationalPanel<TenantHealthData>;
};

export type OperationalSnapshot = {
  version: typeof OPERATIONAL_SNAPSHOT_VERSION;
  generatedAt: string;
  scope: OperationalScope;
  status: OperationalStatus;
  panels: SnapshotPanels;
  alerts: OperationalAlert[];
  readiness: { status: OperationalStatus; gates: ReadinessGate[] };
  notificationDelivery: { configured: false; provider: "NONE"; claim: "NO_EXTERNAL_DELIVERY" };
};

export type OperationalSourceReaders = { [K in keyof SnapshotPanels]: (context: { scope: OperationalScope; now: Date }) => Promise<SnapshotPanels[K]> };

export const OPERATIONAL_PANEL_KEYS: Array<keyof SnapshotPanels> = [
  "system",
  "queues",
  "offline",
  "curriculum",
  "aiQuality",
  "experiments",
  "qualityOperations",
  "incidents",
  "tenants",
];

export const EXTERNAL_READINESS_GATES: ReadinessGate[] = [
  { id: "p1-privileged-mfa", label: "P1 privileged MFA activation", state: "PENDING", evidence: "Repository controls exist; live activation proof remains external." },
  { id: "p1-500-job-run", label: "P1 500-job live queue run", state: "PENDING", evidence: "Harness is verified; live run requires an authorized quiet window." },
  { id: "p1-penetration-test", label: "P1 independent penetration test", state: "PENDING", evidence: "No independent vendor report is recorded." },
  { id: "p2-reviewer-activation", label: "P2 qualified reviewer activation", state: "PENDING", evidence: "Repository workflow exists; human roster activation is not verified." },
  { id: "p2c-governed-activation", label: "P2-C governed activation", state: "PENDING", evidence: "Runtime activation remains a human and MOE decision." },
  { id: "p5-signing-proof", label: "P5 signing-key issuance proof", state: "PENDING", evidence: "Repository trust path is verified; real operational key proof is missing." },
  { id: "p5-field-proof", label: "P5 classroom hub and pilot constraints", state: "PENDING", evidence: "Live school electricity, network, security, device, and support constraints are required." },
  { id: "p5-device-network-proof", label: "P5 named-device and 2G/3G proof", state: "PENDING", evidence: "Physical field evidence has not been supplied." },
  { id: "p7-reviewer-roster", label: "P7 live reviewer roster", state: "PENDING", evidence: "No live quality reviewer roster is verified." },
  { id: "p7-sampled-traffic", label: "P7 real sampled quality traffic", state: "PENDING", evidence: "No real sampled quality traffic is verified." },
  { id: "p7-migrations", label: "P7-C migration application", state: "UNKNOWN", evidence: "Repository migrations passed clean bootstrap; live application is not verified." },
  { id: "nr13-promotion", label: "NR-13 governed DB promotion", state: "PENDING", evidence: "Authored matrix passed; governed promotion remains deliberately unapplied." },
];

function overall(statuses: OperationalStatus[]): OperationalStatus {
  if (statuses.includes("BLOCKED")) return "BLOCKED";
  if (statuses.includes("DEGRADED")) return "DEGRADED";
  if (statuses.includes("UNKNOWN")) return "UNKNOWN";
  return "HEALTHY";
}

function failedPanel(sourceSubsystem: string, scope: OperationalScope, generatedAt: string): OperationalPanel<unknown> {
  return { status: "UNKNOWN", data: null, error: "SOURCE_UNAVAILABLE", provenance: { sourceSubsystem, definitionVersion: "unknown", sourceTimestamp: null, generatedAt, scope, freshness: "UNKNOWN" } };
}

function observations(snapshot: Omit<OperationalSnapshot, "alerts">): AlertObservation[] {
  const at = snapshot.generatedAt;
  const scopeKey = snapshot.scope.kind === "NATIONAL" ? "national" : `school:${snapshot.scope.schoolId}`;
  const queue = snapshot.panels.queues.data;
  const offline = snapshot.panels.offline.data;
  const quality = snapshot.panels.qualityOperations.data;
  const curriculum = snapshot.panels.curriculum.data;
  const experiment = snapshot.panels.experiments.data;
  const oldestMs = queue?.oldestQueuedAt ? Date.parse(at) - Date.parse(queue.oldestQueuedAt) : null;
  return [
    { definition: OPERATIONAL_ALERT_DEFINITIONS.runtimeDown, active: snapshot.panels.system.status === "BLOCKED", scopeKey, observedAt: at, evidence: { status: snapshot.panels.system.status } },
    { definition: OPERATIONAL_ALERT_DEFINITIONS.queueDlq, active: (queue?.dlq ?? 0) > 0, scopeKey, observedAt: at, evidence: { dlq: queue?.dlq ?? null } },
    { definition: OPERATIONAL_ALERT_DEFINITIONS.queueAge, active: oldestMs !== null && oldestMs > 15 * 60_000, scopeKey, observedAt: at, evidence: { oldestQueuedAt: queue?.oldestQueuedAt ?? null } },
    { definition: OPERATIONAL_ALERT_DEFINITIONS.queueBacklog, active: snapshot.panels.queues.status === "DEGRADED" && (queue?.pending ?? 0) > 0, scopeKey, observedAt: at, evidence: { pending: queue?.pending ?? null, status: snapshot.panels.queues.status } },
    { definition: OPERATIONAL_ALERT_DEFINITIONS.offlineFailure, active: (offline?.conflicts ?? 0) > 0 || (offline?.deadLetter ?? 0) > 0 || (offline?.isolationFailures ?? 0) > 0, scopeKey, observedAt: at, evidence: { conflicts: offline?.conflicts ?? null, deadLetter: offline?.deadLetter ?? null, isolationFailures: offline?.isolationFailures ?? null } },
    { definition: OPERATIONAL_ALERT_DEFINITIONS.qualityBlock, active: quality?.releaseGate === "BLOCK", scopeKey, observedAt: at, evidence: { releaseGate: quality?.releaseGate ?? "UNKNOWN" } },
    { definition: OPERATIONAL_ALERT_DEFINITIONS.moderationRegression, active: quality?.moderationRegression === true, scopeKey, observedAt: at, evidence: { moderationRegression: quality?.moderationRegression ?? null } },
    { definition: OPERATIONAL_ALERT_DEFINITIONS.experimentStop, active: experiment?.srm === "SRM_DETECTED" || experiment?.earlyStop === "STOP" || (experiment?.guardrailBreaches ?? 0) > 0, scopeKey, observedAt: at, evidence: { srm: experiment?.srm ?? "UNKNOWN", earlyStop: experiment?.earlyStop ?? "UNKNOWN", guardrailBreaches: experiment?.guardrailBreaches ?? null } },
    { definition: OPERATIONAL_ALERT_DEFINITIONS.staleReview, active: (curriculum?.staleReview ?? 0) > 0 || (quality?.staleReviewTasks ?? 0) > 0, scopeKey, observedAt: at, evidence: { curriculumStale: curriculum?.staleReview ?? null, qualityStale: quality?.staleReviewTasks ?? null } },
  ];
}

export async function getOperationalSnapshot(input: { scope: OperationalScope; readers: OperationalSourceReaders; now?: Date; previousAlerts?: OperationalAlert[]; readinessGates?: ReadinessGate[] }): Promise<OperationalSnapshot> {
  const now = input.now ?? new Date();
  const generatedAt = now.toISOString();
  const keys = OPERATIONAL_PANEL_KEYS;
  const results = await Promise.allSettled(keys.map((key) => input.readers[key]({ scope: input.scope, now })));
  const panels = {} as SnapshotPanels;
  keys.forEach((key, index) => {
    const result = results[index];
    if (result.status !== "fulfilled") {
      (panels as Record<string, unknown>)[key] = failedPanel(String(key), input.scope, generatedAt);
      return;
    }
    const value = result.value;
    const status = value.status === "HEALTHY" && value.provenance.freshness === "STALE"
      ? "DEGRADED"
      : value.status === "HEALTHY" && value.provenance.freshness === "UNKNOWN"
        ? "UNKNOWN"
        : value.status;
    (panels as Record<string, unknown>)[key] = { ...value, status };
  });
  const readinessGates = input.readinessGates ?? EXTERNAL_READINESS_GATES;
  const readiness = { status: overall(readinessGates.map((gate) => gate.state === "BLOCKED" ? "BLOCKED" : gate.state === "VERIFIED" ? "HEALTHY" : "UNKNOWN")), gates: readinessGates };
  const base = { version: OPERATIONAL_SNAPSHOT_VERSION, generatedAt, scope: input.scope, status: overall(Object.values(panels).map((panel) => panel.status)), panels, readiness, notificationDelivery: { configured: false as const, provider: "NONE" as const, claim: "NO_EXTERNAL_DELIVERY" as const } };
  return { ...base, alerts: reconcileOperationalAlerts(input.previousAlerts ?? [], observations(base)) };
}

export const P7_PROVENANCE = { measurementMetricVersion: GOVERNED_METRIC_VERSION, experimentAuthority: "lib/experiments/controlledExperiment.ts", qualityAuthority: "lib/quality/releaseGate.ts" } as const;


