import { GOVERNED_METRIC_VERSION, METRIC_REGISTRY, validateGovernedEvent, type GovernedEvent, type MeasurementFamily } from "@/lib/measurement/governedMeasurement";

export type ExperimentStatus = "DRAFT" | "READY" | "RUNNING" | "PAUSED" | "STOPPED" | "COMPLETED" | "CANCELLED";
export type AssignmentUnit = "SCHOOL" | "CLASS";
export type ExperimentArm = { id: string; kind: "CONTROL" | "TREATMENT" | "HOLDOUT"; allocationBps: number };
export type Eligibility = { schoolIds?: string[]; classIds?: string[]; grades?: number[]; subjects?: string[]; minClientVersion?: string; excludeSynthetic?: boolean; excludeInternal?: boolean };
export type Guardrail = { metricId: MeasurementFamily; direction: "MAX" | "MIN"; threshold: number };
export type EarlyStopPolicy = { minimumSample: number; srmThreshold: number; guardrails: Guardrail[] };
export type ExperimentDefinition = { experimentId: string; version: number; metricVersion: number; name: string; description: string; owner: string; status: ExperimentStatus; unitOfAssignment: AssignmentUnit; eligiblePopulation: Eligibility; arms: ExperimentArm[]; controlArm: string; startAt: string; endAt: string; conflictDomains: string[]; primaryMetrics: MeasurementFamily[]; secondaryMetrics: MeasurementFamily[]; guardrails: Guardrail[]; earlyStopPolicy: EarlyStopPolicy; createdAt: string; safetyPolicyVariable?: boolean };
export type AssignmentContext = { schoolId: string; classId?: string; grade?: number; subject?: string; clientVersion?: string; syntheticSource?: string; internal?: boolean; now?: string };
export type Assignment = { experimentId: string; experimentVersion: number; definitionHash: string; algorithmVersion: "fnv1a-v1"; schoolId: string; assignmentUnit: AssignmentUnit; assignmentId: string; armId: string; armKind: ExperimentArm["kind"]; assignedAt: string; eligibilityReason: string };
export type Resolution = { eligible: false; reason: string } | { eligible: true; assignment: Assignment };
export type ExposureInput = { assignment: Assignment; schoolId: string; actorType: GovernedEvent["actorType"]; actorId?: string; occurredAt: string; sessionId?: string; featureKey: string; contentVersion?: string; offline?: boolean; syntheticSource?: GovernedEvent["syntheticSource"] };

const metricIds = new Set(METRIC_REGISTRY.map((metric) => metric.id));
const validStatuses = new Set<ExperimentStatus>(["DRAFT", "READY", "RUNNING", "PAUSED", "STOPPED", "COMPLETED", "CANCELLED"]);
const hash = (input: string) => { let value = 2166136261; for (let index = 0; index < input.length; index++) { value ^= input.charCodeAt(index); value = Math.imul(value, 16777619); } return value >>> 0; };
const definitionHash = (definition: ExperimentDefinition) => hash(JSON.stringify({ ...definition, status: undefined, createdAt: undefined })).toString(16);
const parseSemver = (value: string) => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match ? match.slice(1).map(Number) as [number, number, number] : null;
};
const atLeastSemver = (actual: string, minimum: string) => {
  const parsedActual = parseSemver(actual), parsedMinimum = parseSemver(minimum);
  if (!parsedActual || !parsedMinimum) return false;
  return parsedActual.some((part, index) => part !== parsedMinimum[index] && part > parsedMinimum[index]) || parsedActual.every((part, index) => part === parsedMinimum[index]);
};

export function validateExperimentDefinition(definition: ExperimentDefinition): string[] {
  const errors: string[] = [];
  if (!definition.experimentId.trim() || !definition.name.trim() || !definition.owner.trim()) errors.push("missing_identity");
  if (!Number.isInteger(definition.version) || definition.version < 1) errors.push("invalid_version");
  if (definition.metricVersion !== GOVERNED_METRIC_VERSION) errors.push("unsupported_metric_version");
  if (!validStatuses.has(definition.status)) errors.push("invalid_status");
  if (definition.unitOfAssignment !== "SCHOOL" && definition.unitOfAssignment !== "CLASS") errors.push("invalid_assignment_unit");
  if (definition.safetyPolicyVariable) errors.push("mandatory_safety_policy_cannot_vary");
  if (Number.isNaN(Date.parse(definition.startAt)) || Number.isNaN(Date.parse(definition.endAt)) || Date.parse(definition.endAt) <= Date.parse(definition.startAt)) errors.push("invalid_window");
  if (!definition.arms.length || new Set(definition.arms.map((arm) => arm.id)).size !== definition.arms.length) errors.push("invalid_arms");
  if (!definition.arms.some((arm) => arm.id === definition.controlArm && arm.kind === "CONTROL")) errors.push("missing_control_arm");
  if (definition.arms.some((arm) => !arm.id.trim() || !Number.isInteger(arm.allocationBps) || arm.allocationBps < 0)) errors.push("invalid_allocation");
  if (definition.arms.reduce((total, arm) => total + arm.allocationBps, 0) !== 10000) errors.push("allocation_must_sum_to_10000");
  for (const metric of [...definition.primaryMetrics, ...definition.secondaryMetrics, ...definition.guardrails.map((guardrail) => guardrail.metricId), ...definition.earlyStopPolicy.guardrails.map((guardrail) => guardrail.metricId)]) if (!metricIds.has(metric)) errors.push(`unknown_metric:${metric}`);
  if (!definition.primaryMetrics.length) errors.push("missing_primary_metric");
  if (definition.earlyStopPolicy.minimumSample < 1 || definition.earlyStopPolicy.srmThreshold <= 0) errors.push("invalid_early_stop_policy");
  if (definition.eligiblePopulation.minClientVersion && !parseSemver(definition.eligiblePopulation.minClientVersion)) errors.push("invalid_min_client_version");
  return errors;
}

/** Material definition changes are a new experiment version, never a rewrite of history. */
export function validateExperimentVersionTransition(previous: ExperimentDefinition, next: ExperimentDefinition): string[] {
  if (previous.experimentId !== next.experimentId) return ["experiment_id_immutable"];
  if (next.version < previous.version) return ["experiment_version_cannot_decrease"];
  if (next.version === previous.version && definitionHash(previous) !== definitionHash(next)) return ["material_change_requires_new_version"];
  return [];
}

function isEligible(definition: ExperimentDefinition, context: AssignmentContext): string | null {
  const now = Date.parse(context.now ?? new Date().toISOString());
  if (definition.status !== "RUNNING") return "experiment_not_running";
  if (now < Date.parse(definition.startAt) || now >= Date.parse(definition.endAt)) return "outside_experiment_window";
  if (definition.eligiblePopulation.excludeSynthetic !== false && context.syntheticSource && context.syntheticSource !== "production") return "synthetic_excluded";
  if (definition.eligiblePopulation.excludeInternal !== false && context.internal) return "internal_excluded";
  if (definition.eligiblePopulation.schoolIds && !definition.eligiblePopulation.schoolIds.includes(context.schoolId)) return "school_ineligible";
  if (definition.unitOfAssignment === "CLASS" && !context.classId) return "class_required";
  if (definition.eligiblePopulation.classIds && (!context.classId || !definition.eligiblePopulation.classIds.includes(context.classId))) return "class_ineligible";
  if (definition.eligiblePopulation.grades && (!context.grade || !definition.eligiblePopulation.grades.includes(context.grade))) return "grade_ineligible";
  if (definition.eligiblePopulation.subjects && (!context.subject || !definition.eligiblePopulation.subjects.includes(context.subject))) return "subject_ineligible";
  if (definition.eligiblePopulation.minClientVersion && (!context.clientVersion || !atLeastSemver(context.clientVersion, definition.eligiblePopulation.minClientVersion))) return "client_version_ineligible";
  return null;
}

export function resolveExperimentTreatment(definition: ExperimentDefinition, context: AssignmentContext): Resolution {
  const errors = validateExperimentDefinition(definition); if (errors.length) return { eligible: false, reason: `invalid_definition:${errors.join(",")}` };
  const reason = isEligible(definition, context); if (reason) return { eligible: false, reason };
  const assignmentId = definition.unitOfAssignment === "SCHOOL" ? context.schoolId : context.classId!;
  const bucket = hash(`${definition.experimentId}:${definition.version}:${definition.unitOfAssignment}:${context.schoolId}:${assignmentId}`) % 10000;
  let cursor = 0; const arm = definition.arms.find((candidate) => { cursor += candidate.allocationBps; return bucket < cursor; });
  if (!arm) return { eligible: false, reason: "allocation_resolution_failed" };
  return { eligible: true, assignment: { experimentId: definition.experimentId, experimentVersion: definition.version, definitionHash: definitionHash(definition), algorithmVersion: "fnv1a-v1", schoolId: context.schoolId, assignmentUnit: definition.unitOfAssignment, assignmentId, armId: arm.id, armKind: arm.kind, assignedAt: context.now ?? new Date().toISOString(), eligibilityReason: "eligible" } };
}

export function findExperimentConflicts(candidate: ExperimentDefinition, active: ExperimentDefinition[]): string[] {
  return active.filter((experiment) => experiment.status === "RUNNING" && experiment.experimentId !== candidate.experimentId && experiment.conflictDomains.some((domain) => candidate.conflictDomains.includes(domain))).map((experiment) => experiment.experimentId);
}

const transitions: Record<ExperimentStatus, ExperimentStatus[]> = { DRAFT: ["READY", "CANCELLED"], READY: ["RUNNING", "CANCELLED"], RUNNING: ["PAUSED", "STOPPED", "COMPLETED"], PAUSED: ["RUNNING", "STOPPED", "CANCELLED"], STOPPED: [], COMPLETED: [], CANCELLED: [] };
export type ExperimentAuditRecord = { action: "experiment.lifecycle_changed"; experimentId: string; version: number; from: ExperimentStatus; to: ExperimentStatus; actorId: string; occurredAt: string; definitionHash: string };
export function transitionExperimentLifecycle(definition: ExperimentDefinition, to: ExperimentStatus, actorId: string, occurredAt: string): { definition: ExperimentDefinition; audit: ExperimentAuditRecord } {
  if (!transitions[definition.status].includes(to)) throw new Error("invalid_lifecycle_transition");
  if (!actorId.trim() || Number.isNaN(Date.parse(occurredAt))) throw new Error("invalid_lifecycle_audit_context");
  return { definition: { ...definition, status: to }, audit: { action: "experiment.lifecycle_changed", experimentId: definition.experimentId, version: definition.version, from: definition.status, to, actorId, occurredAt, definitionHash: definitionHash(definition) } };
}

export function createExposureEvent(input: ExposureInput): GovernedEvent {
  if (input.schoolId !== input.assignment.schoolId) throw new Error("cross_school_exposure_rejected");
  const session = input.sessionId ?? "single"; const event: GovernedEvent = { eventId: `exp:${input.assignment.experimentId}:${input.assignment.experimentVersion}:${input.assignment.assignmentId}:${input.assignment.armId}:${session}:${input.featureKey}`, name: "governed.experiment.exposure", schemaVersion: 1, occurredAt: input.occurredAt, schoolId: input.schoolId, actorType: input.actorType, actorId: input.actorId, sessionId: input.sessionId, operationId: `exposure:${input.assignment.experimentId}:${input.assignment.experimentVersion}:${input.assignment.assignmentId}:${input.assignment.armId}:${session}:${input.featureKey}`, syntheticSource: input.syntheticSource ?? "production", metadata: { experimentId: input.assignment.experimentId, experimentVersion: input.assignment.experimentVersion, armId: input.assignment.armId, assignmentUnit: input.assignment.assignmentUnit, assignmentId: input.assignment.assignmentId, featureKey: input.featureKey, ...(input.contentVersion ? { contentVersion: input.contentVersion } : {}), ...(input.offline ? { offline: true } : {}) } };
  const result = validateGovernedEvent(event); if (result.ok === false) throw new Error(`invalid_exposure:${result.reason}`); return event;
}

export type SrmResult = { status: "INSUFFICIENT_DATA" | "NORMAL" | "SRM_DETECTED"; total: number; chiSquare: number; threshold: number; observed: Record<string, number> };
export function detectSampleRatioMismatch(definition: ExperimentDefinition, assignments: Assignment[], minimumSample = definition.earlyStopPolicy.minimumSample): SrmResult {
  const observed: Record<string, number> = Object.fromEntries(definition.arms.map((arm) => [arm.id, 0])); for (const assignment of assignments) if (assignment.experimentId === definition.experimentId && assignment.experimentVersion === definition.version && assignment.armId in observed) observed[assignment.armId]++;
  const total = Object.values(observed).reduce((sum, count) => sum + count, 0); if (total < minimumSample) return { status: "INSUFFICIENT_DATA", total, chiSquare: 0, threshold: definition.earlyStopPolicy.srmThreshold, observed };
  const chiSquare = definition.arms.reduce((sum, arm) => { const expected = total * arm.allocationBps / 10000; return expected ? sum + ((observed[arm.id] - expected) ** 2) / expected : sum; }, 0);
  return { status: chiSquare >= definition.earlyStopPolicy.srmThreshold ? "SRM_DETECTED" : "NORMAL", total, chiSquare, threshold: definition.earlyStopPolicy.srmThreshold, observed };
}

export type ExperimentOutcome = { armId: string; exposed: number; successes: number };
export type ExperimentAnalysis = { status: "INSUFFICIENT_DATA" | "ANALYZABLE" | "INVALID_ASSIGNMENT_INTEGRITY"; metricVersion: number; control: ExperimentOutcome; treatments: Array<ExperimentOutcome & { difference: number | null; confidenceInterval95: [number, number] | null }>; srm: SrmResult; provenance: { metricIds: MeasurementFamily[]; definitionHash: string; algorithmVersion: string; assignmentCount: number; exposureCount: number } };
export function analyzeExperiment(definition: ExperimentDefinition, assignments: Assignment[], outcomes: ExperimentOutcome[]): ExperimentAnalysis {
  const srm = detectSampleRatioMismatch(definition, assignments); const control = outcomes.find((outcome) => outcome.armId === definition.controlArm) ?? { armId: definition.controlArm, exposed: 0, successes: 0 }; const treatmentRows = outcomes.filter((outcome) => outcome.armId !== definition.controlArm); const insufficient = control.exposed < definition.earlyStopPolicy.minimumSample || treatmentRows.some((outcome) => outcome.exposed < definition.earlyStopPolicy.minimumSample);
  const treatments = treatmentRows.map((treatment) => { if (insufficient || !control.exposed || !treatment.exposed) return { ...treatment, difference: null, confidenceInterval95: null }; const pControl = control.successes / control.exposed, pTreatment = treatment.successes / treatment.exposed, difference = pTreatment - pControl, margin = 1.96 * Math.sqrt((pControl * (1 - pControl) / control.exposed) + (pTreatment * (1 - pTreatment) / treatment.exposed)); return { ...treatment, difference, confidenceInterval95: [difference - margin, difference + margin] as [number, number] }; });
  return { status: srm.status === "SRM_DETECTED" ? "INVALID_ASSIGNMENT_INTEGRITY" : insufficient ? "INSUFFICIENT_DATA" : "ANALYZABLE", metricVersion: GOVERNED_METRIC_VERSION, control, treatments, srm, provenance: { metricIds: definition.primaryMetrics, definitionHash: definitionHash(definition), algorithmVersion: "fnv1a-v1", assignmentCount: assignments.length, exposureCount: outcomes.reduce((sum, outcome) => sum + outcome.exposed, 0) } };
}

export function evaluateEarlyStop(definition: ExperimentDefinition, metrics: Record<string, number>, assignments: Assignment[]) { const srm = detectSampleRatioMismatch(definition, assignments); const breaches = definition.earlyStopPolicy.guardrails.filter((guardrail) => guardrail.direction === "MAX" ? (metrics[guardrail.metricId] ?? 0) > guardrail.threshold : (metrics[guardrail.metricId] ?? 0) < guardrail.threshold).map((guardrail) => guardrail.metricId); return { shouldStop: srm.status === "SRM_DETECTED" || breaches.length > 0, reason: srm.status === "SRM_DETECTED" ? "sample_ratio_mismatch" : breaches.length ? "guardrail_breach" : null, breaches, srm };
}
