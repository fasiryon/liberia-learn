/**
 * P7-A governed measurement contract.
 *
 * This module is deliberately database-free.  It validates the event envelope
 * before an adapter persists it, and calculates reproducible metrics from a
 * supplied, tenant-scoped event set.  Existing LearningEvent rows remain
 * interpretable as legacy events; only registered `governed.*` names are
 * governed measurement authority.
 */

export const GOVERNED_EVENT_SCHEMA_VERSION = 1 as const;
export const GOVERNED_METRIC_VERSION = 1 as const;

export type MeasurementFamily =
  | "learning_dosage" | "retention" | "mastery_movement" | "teacher_adoption"
  | "workflow_completion" | "tutor_helpfulness" | "ai_grounding"
  | "hallucination" | "safety_decisions";

export type SyntheticSource = "production" | "seed" | "fixture" | "demo" | "e2e" | "load_test" | "sandbox" | "internal_qa";
export type EventPrivacy = "aggregate_safe" | "pseudonymous" | "restricted";

export type GovernedEvent = {
  eventId: string;
  name: string;
  schemaVersion: number;
  occurredAt: string;
  receivedAt?: string;
  schoolId: string;
  actorType: "learner" | "teacher" | "system" | "reviewer";
  actorId?: string;
  subjectId?: string;
  sessionId?: string;
  operationId?: string;
  sourceEventId?: string;
  syntheticSource: SyntheticSource;
  metadata: Record<string, unknown>;
};

export type EventDefinition = {
  name: string;
  family: MeasurementFamily;
  actorTypes: readonly GovernedEvent["actorType"][];
  requiredMetadata: readonly string[];
  optionalMetadata: readonly string[];
  sourceSubsystem: string;
  privacy: EventPrivacy;
  timestampSemantics: "learner_action" | "server_decision" | "human_review";
  identity: "eventId plus operationId/sourceEventId when replayable";
};

const definition = (input: Omit<EventDefinition, "identity">): EventDefinition => ({
  ...input,
  identity: "eventId plus operationId/sourceEventId when replayable",
});

export const EVENT_REGISTRY: readonly EventDefinition[] = [
  definition({ name: "governed.learning.activity", family: "learning_dosage", actorTypes: ["learner"], requiredMetadata: ["activeSeconds"], optionalMetadata: ["contentVersion"], sourceSubsystem: "lesson runtime", privacy: "pseudonymous", timestampSemantics: "learner_action" }),
  definition({ name: "governed.retention.cohort_entered", family: "retention", actorTypes: ["learner"], requiredMetadata: [], optionalMetadata: ["cohortId"], sourceSubsystem: "lesson runtime", privacy: "pseudonymous", timestampSemantics: "learner_action" }),
  definition({ name: "governed.retention.learning_day", family: "retention", actorTypes: ["learner"], requiredMetadata: [], optionalMetadata: [], sourceSubsystem: "lesson runtime", privacy: "pseudonymous", timestampSemantics: "learner_action" }),
  definition({ name: "governed.mastery.snapshot", family: "mastery_movement", actorTypes: ["learner", "system"], requiredMetadata: ["mastery", "assessmentVersion"], optionalMetadata: ["evidenceCount", "strandId"], sourceSubsystem: "mastery engine", privacy: "pseudonymous", timestampSemantics: "server_decision" }),
  definition({ name: "governed.teacher.meaningful_action", family: "teacher_adoption", actorTypes: ["teacher"], requiredMetadata: ["action"], optionalMetadata: ["classId"], sourceSubsystem: "teacher workflow", privacy: "pseudonymous", timestampSemantics: "learner_action" }),
  definition({ name: "governed.teacher.eligible", family: "teacher_adoption", actorTypes: ["teacher", "system"], requiredMetadata: [], optionalMetadata: [], sourceSubsystem: "teacher directory", privacy: "pseudonymous", timestampSemantics: "server_decision" }),
  definition({ name: "governed.workflow.started", family: "workflow_completion", actorTypes: ["learner", "teacher", "system"], requiredMetadata: ["workflow", "workflowId"], optionalMetadata: [], sourceSubsystem: "workflow runtime", privacy: "pseudonymous", timestampSemantics: "learner_action" }),
  definition({ name: "governed.workflow.completed", family: "workflow_completion", actorTypes: ["learner", "teacher", "system"], requiredMetadata: ["workflow", "workflowId"], optionalMetadata: [], sourceSubsystem: "workflow runtime", privacy: "pseudonymous", timestampSemantics: "server_decision" }),
  definition({ name: "governed.workflow.failed", family: "workflow_completion", actorTypes: ["learner", "teacher", "system"], requiredMetadata: ["workflow", "workflowId", "reason"], optionalMetadata: [], sourceSubsystem: "workflow runtime", privacy: "aggregate_safe", timestampSemantics: "server_decision" }),
  definition({ name: "governed.workflow.abandoned", family: "workflow_completion", actorTypes: ["learner", "teacher", "system"], requiredMetadata: ["workflow", "workflowId", "timeoutReason"], optionalMetadata: [], sourceSubsystem: "workflow runtime", privacy: "aggregate_safe", timestampSemantics: "server_decision" }),
  definition({ name: "governed.tutor.feedback", family: "tutor_helpfulness", actorTypes: ["learner", "teacher", "reviewer"], requiredMetadata: ["helpful"], optionalMetadata: ["interactionId"], sourceSubsystem: "tutor", privacy: "pseudonymous", timestampSemantics: "learner_action" }),
  definition({ name: "governed.ai.grounding_evaluated", family: "ai_grounding", actorTypes: ["system", "reviewer"], requiredMetadata: ["grounded", "evaluatorVersion", "approvedContextAvailable"], optionalMetadata: ["interactionId"], sourceSubsystem: "AI quality", privacy: "aggregate_safe", timestampSemantics: "human_review" }),
  definition({ name: "governed.ai.hallucination_evaluated", family: "hallucination", actorTypes: ["system", "reviewer"], requiredMetadata: ["unsupportedClaim", "evaluatorVersion", "category"], optionalMetadata: ["interactionId"], sourceSubsystem: "AI quality", privacy: "aggregate_safe", timestampSemantics: "human_review" }),
  definition({ name: "governed.safety.required", family: "safety_decisions", actorTypes: ["system"], requiredMetadata: ["interactionId"], optionalMetadata: [], sourceSubsystem: "safety moderation", privacy: "restricted", timestampSemantics: "server_decision" }),
  definition({ name: "governed.safety.decision", family: "safety_decisions", actorTypes: ["system", "reviewer"], requiredMetadata: ["interactionId", "decision", "classifierVersion"], optionalMetadata: ["reviewOutcome"], sourceSubsystem: "safety moderation", privacy: "restricted", timestampSemantics: "server_decision" }),
  definition({ name: "governed.safety.review", family: "safety_decisions", actorTypes: ["reviewer"], requiredMetadata: ["reviewOutcome", "classifierVersion"], optionalMetadata: ["decision"], sourceSubsystem: "safety moderation", privacy: "restricted", timestampSemantics: "human_review" }),
] as const;

export type MetricDefinition = {
  id: MeasurementFamily;
  version: number;
  displayName: string;
  owner: string;
  sourceEvents: readonly string[];
  numerator: string;
  denominator: string;
  eligibility: string;
  window: string;
  missingData: string;
  syntheticExclusion: true;
  grain: string;
  unit: string;
  directionality: "higher_is_better" | "lower_is_better" | "descriptive";
  caveats: string;
};

const metric = (input: Omit<MetricDefinition, "version" | "syntheticExclusion">): MetricDefinition => ({ ...input, version: GOVERNED_METRIC_VERSION, syntheticExclusion: true });

export const METRIC_REGISTRY: readonly MetricDefinition[] = [
  metric({ id: "learning_dosage", displayName: "Active learning dosage", owner: "Learning Engineering", sourceEvents: ["governed.learning.activity"], numerator: "sum validated activeSeconds", denominator: "eligible distinct learners", eligibility: "learner with a valid activity event in window", window: "academic UTC day or requested inclusive interval", missingData: "unknown activity is excluded, never zero-filled", grain: "school, academic day", unit: "seconds per eligible learner", directionality: "higher_is_better", caveats: "background and page-load time are not dosage" }),
  metric({ id: "retention", displayName: "Learning retention", owner: "Learning Engineering", sourceEvents: ["governed.retention.cohort_entered", "governed.retention.learning_day"], numerator: "eligible cohort learners with later learning day", denominator: "eligible cohort entrants", eligibility: "cohort entrant with observable return window", window: "7 complete calendar days after entry", missingData: "missing return event is unknown unless collection coverage is confirmed", grain: "school, entry cohort", unit: "proportion", directionality: "higher_is_better", caveats: "this is learning retention, not login retention" }),
  metric({ id: "mastery_movement", displayName: "Positive mastery movement", owner: "Learning Science", sourceEvents: ["governed.mastery.snapshot"], numerator: "eligible learner-strands ending above starting mastery", denominator: "eligible learner-strands with two valid snapshots", eligibility: "same assessment version and at least two snapshots", window: "requested interval", missingData: "incomplete snapshot pair is excluded", grain: "school, strand", unit: "proportion", directionality: "higher_is_better", caveats: "retries do not create movement without a new canonical snapshot" }),
  metric({ id: "teacher_adoption", displayName: "Meaningful teacher adoption", owner: "Teaching Experience", sourceEvents: ["governed.teacher.eligible", "governed.teacher.meaningful_action"], numerator: "eligible teachers with a meaningful teaching action", denominator: "eligible teachers observed in scope", eligibility: "teacher eligibility event with valid tenant scope", window: "rolling 28 days", missingData: "unobserved teachers are excluded, never inferred active", grain: "school", unit: "proportion", directionality: "higher_is_better", caveats: "account creation and login are excluded" }),
  metric({ id: "workflow_completion", displayName: "Workflow completion", owner: "Product Operations", sourceEvents: ["governed.workflow.started", "governed.workflow.completed", "governed.workflow.failed", "governed.workflow.abandoned"], numerator: "started workflows with matching completion", denominator: "valid workflow starts", eligibility: "start with workflowId and observed close window", window: "24 hours after start", missingData: "unclosed workflows remain unknown until timeout", grain: "school, workflow", unit: "proportion", directionality: "higher_is_better", caveats: "failure and abandonment are reported separately" }),
  metric({ id: "tutor_helpfulness", displayName: "Tutor helpfulness", owner: "AI Quality", sourceEvents: ["governed.tutor.feedback"], numerator: "positive explicit feedback", denominator: "feedback responses", eligibility: "valid explicit feedback", window: "rolling 28 days", missingData: "no feedback is excluded, not treated as negative", grain: "school, tutor version", unit: "proportion", directionality: "higher_is_better", caveats: "generation is not evidence of helpfulness" }),
  metric({ id: "ai_grounding", displayName: "AI grounding", owner: "AI Quality", sourceEvents: ["governed.ai.grounding_evaluated"], numerator: "evaluations marked grounded with approved context", denominator: "evaluated responses with approved context available", eligibility: "evaluator version and context availability recorded", window: "rolling 28 days", missingData: "unevaluated answers are excluded", grain: "school, evaluator version", unit: "proportion", directionality: "higher_is_better", caveats: "citations alone do not prove grounding" }),
  metric({ id: "hallucination", displayName: "Unsupported claim rate", owner: "AI Quality", sourceEvents: ["governed.ai.hallucination_evaluated"], numerator: "evaluations with unsupportedClaim true", denominator: "evaluated responses", eligibility: "evaluator version and category recorded", window: "rolling 28 days", missingData: "unevaluated answers are excluded", grain: "school, evaluator version", unit: "proportion", directionality: "lower_is_better", caveats: "category separates unsupported claims from safety findings" }),
  metric({ id: "safety_decisions", displayName: "Safety decision coverage", owner: "Child Safety", sourceEvents: ["governed.safety.required", "governed.safety.decision", "governed.safety.review"], numerator: "required interactions with a valid allowed, blocked, escalated, unavailable, or malformed decision", denominator: "AI interactions requiring moderation decisions", eligibility: "required interaction plus decision and classifier version recorded", window: "rolling 28 days", missingData: "a required interaction without a decision remains in the denominator; classifier unavailable is a named decision, never allowed", grain: "school, classifier version", unit: "proportion", directionality: "higher_is_better", caveats: "review outcomes explicitly distinguish false positives and false negatives; telemetry contains categories, not safeguarding content" }),
] as const;

const registryByName = new Map(EVENT_REGISTRY.map((item) => [item.name, item]));
export const GOVERNED_EVENT_NAMES = new Set(EVENT_REGISTRY.map((item) => item.name));

export type ValidationResult = { ok: true; event: GovernedEvent } | { ok: false; reason: string };
const isString = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const isBoolean = (value: unknown) => typeof value === "boolean";
const isPositiveNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isMastery = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const isNonNegativeInteger = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0;
const enumValue = (values: string[]) => (value: unknown) => isString(value) && values.includes(value as string);
const METADATA_VALIDATORS: Record<string, Record<string, (value: unknown) => boolean>> = {
  "governed.learning.activity": { activeSeconds: isPositiveNumber, contentVersion: isString },
  "governed.retention.cohort_entered": { cohortId: isString }, "governed.retention.learning_day": {},
  "governed.mastery.snapshot": { mastery: isMastery, assessmentVersion: isString, evidenceCount: isNonNegativeInteger, strandId: isString },
  "governed.teacher.eligible": {}, "governed.teacher.meaningful_action": { action: isString, classId: isString },
  "governed.workflow.started": { workflow: isString, workflowId: isString }, "governed.workflow.completed": { workflow: isString, workflowId: isString },
  "governed.workflow.failed": { workflow: isString, workflowId: isString, reason: isString }, "governed.workflow.abandoned": { workflow: isString, workflowId: isString, timeoutReason: isString },
  "governed.tutor.feedback": { helpful: isBoolean, interactionId: isString },
  "governed.ai.grounding_evaluated": { grounded: isBoolean, evaluatorVersion: isString, approvedContextAvailable: isBoolean, interactionId: isString },
  "governed.ai.hallucination_evaluated": { unsupportedClaim: isBoolean, evaluatorVersion: isString, category: isString, interactionId: isString },
  "governed.safety.required": { interactionId: isString },
  "governed.safety.decision": { interactionId: isString, decision: enumValue(["allowed", "blocked", "escalated", "classifier_unavailable", "classifier_malformed"]), classifierVersion: isString, reviewOutcome: enumValue(["false_positive", "false_negative", "confirmed"]) },
  "governed.safety.review": { reviewOutcome: enumValue(["false_positive", "false_negative", "confirmed"]), classifierVersion: isString, decision: enumValue(["allowed", "blocked", "escalated", "classifier_unavailable", "classifier_malformed"]) },
};
export function validateGovernedEvent(input: unknown): ValidationResult {
  if (!input || typeof input !== "object") return { ok: false, reason: "event_not_object" };
  const event = input as Partial<GovernedEvent>;
  const definition = typeof event.name === "string" ? registryByName.get(event.name) : undefined;
  if (!definition) return { ok: false, reason: "unknown_event_name" };
  if (event.schemaVersion !== GOVERNED_EVENT_SCHEMA_VERSION) return { ok: false, reason: "unsupported_schema_version" };
  if (!event.eventId?.trim()) return { ok: false, reason: "missing_event_id" };
  if (!event.schoolId?.trim()) return { ok: false, reason: "missing_school_id" };
  if (!event.occurredAt || Number.isNaN(Date.parse(event.occurredAt))) return { ok: false, reason: "invalid_occurred_at" };
  if (!definition.actorTypes.includes(event.actorType as GovernedEvent["actorType"])) return { ok: false, reason: "invalid_actor_type" };
  if (!event.syntheticSource || !["production", "seed", "fixture", "demo", "e2e", "load_test", "sandbox", "internal_qa"].includes(event.syntheticSource)) return { ok: false, reason: "invalid_synthetic_source" };
  if (!event.metadata || typeof event.metadata !== "object") return { ok: false, reason: "missing_metadata" };
  for (const key of definition.requiredMetadata) if (!(key in event.metadata)) return { ok: false, reason: `missing_required_metadata:${key}` };
  const validators = METADATA_VALIDATORS[definition.name];
  for (const [key, value] of Object.entries(event.metadata)) {
    const validator = validators[key];
    if (!validator) return { ok: false, reason: `unregistered_metadata:${key}` };
    if (!validator(value)) return { ok: false, reason: `invalid_metadata:${key}` };
  }
  return { ok: true, event: event as GovernedEvent };
}

export type IngestionResult = { accepted: GovernedEvent[]; quarantined: Array<{ event: unknown; reason: string }>; duplicates: number };
export function ingestGovernedEvents(inputs: unknown[]): IngestionResult {
  const accepted: GovernedEvent[] = []; const quarantined: IngestionResult["quarantined"] = []; const identities = new Set<string>(); let duplicates = 0;
  for (const input of inputs) {
    const result = validateGovernedEvent(input);
    if (result.ok === false) { quarantined.push({ event: input, reason: result.reason }); continue; }
    const identity = `${result.event.schoolId}:${result.event.name}:${result.event.operationId || result.event.sourceEventId || result.event.eventId}`;
    if (identities.has(identity)) { duplicates += 1; continue; }
    identities.add(identity); accepted.push(result.event);
  }
  return { accepted, quarantined, duplicates };
}

export type MetricResult = { metricId: MeasurementFamily; metricVersion: number; numerator: number; denominator: number; value: number | null; includedEventSchemaVersions: number[]; excludedSyntheticEvents: number; missingDataEvents: number; quarantinedEvents: number; duplicateEvents: number; schoolId: string; window: { start: string; end: string } };
export function calculateMetric(metricId: MeasurementFamily, inputs: unknown[], schoolId: string, window: { start: string; end: string }): MetricResult {
  const start = Date.parse(window.start), end = Date.parse(window.end);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) throw new Error("invalid_metric_window");
  const ingestion = ingestGovernedEvents(inputs);
  const accepted = ingestion.accepted;
  const inWindow = accepted.filter((e) => e.schoolId === schoolId && e.syntheticSource === "production" && Date.parse(e.occurredAt) >= start && Date.parse(e.occurredAt) <= end);
  const excludedSyntheticEvents = accepted.filter((e) => e.schoolId === schoolId && e.syntheticSource !== "production").length;
  const named = (name: string) => inWindow.filter((e) => e.name === name);
  let numerator = 0, denominator = 0, missingDataEvents = 0;
  if (metricId === "learning_dosage") { const rows = named("governed.learning.activity"); const valid = rows.filter((e) => typeof e.metadata.activeSeconds === "number" && Number(e.metadata.activeSeconds) > 0); numerator = valid.reduce((sum, e) => sum + Number(e.metadata.activeSeconds), 0); denominator = new Set(valid.map((e) => e.actorId).filter(Boolean)).size; missingDataEvents = rows.length - valid.length; }
  if (metricId === "retention") { const returns = named("governed.retention.learning_day").filter((e) => e.actorId); for (const entry of named("governed.retention.cohort_entered").filter((e) => e.actorId)) { const entryAt = Date.parse(entry.occurredAt), observableEnd = entryAt + 7 * 24 * 60 * 60 * 1000; if (observableEnd > end) { missingDataEvents++; continue; } denominator++; if (returns.some((candidate) => candidate.actorId === entry.actorId && Date.parse(candidate.occurredAt) > entryAt && Date.parse(candidate.occurredAt) <= observableEnd)) numerator++; } }
  if (metricId === "mastery_movement") { const groups = new Map<string, GovernedEvent[]>(); for (const e of named("governed.mastery.snapshot")) { const key = `${e.actorId}:${String(e.metadata.strandId ?? "")}`; groups.set(key, [...(groups.get(key) ?? []), e]); } for (const rows of groups.values()) { const valid = rows.filter((e) => typeof e.metadata.mastery === "number" && typeof e.metadata.assessmentVersion === "string").sort((a,b) => a.occurredAt.localeCompare(b.occurredAt)); const ending = valid[valid.length - 1]; if (valid.length < 2 || valid[0].metadata.assessmentVersion !== ending?.metadata.assessmentVersion) { missingDataEvents += rows.length; continue; } denominator++; if (Number(ending.metadata.mastery) > Number(valid[0].metadata.mastery)) numerator++; } }
  if (metricId === "teacher_adoption") { const eligible = new Set(named("governed.teacher.eligible").map((e) => e.actorId).filter(Boolean)); const adopters = new Set(named("governed.teacher.meaningful_action").filter((e) => eligible.has(e.actorId)).map((e) => e.actorId)); denominator = eligible.size; numerator = adopters.size; }
  if (metricId === "workflow_completion") { const completed = named("governed.workflow.completed"); const starts = named("governed.workflow.started"); denominator = starts.length; numerator = starts.filter((entry) => completed.some((done) => done.actorId === entry.actorId && done.metadata.workflow === entry.metadata.workflow && done.metadata.workflowId === entry.metadata.workflowId && Date.parse(done.occurredAt) > Date.parse(entry.occurredAt) && Date.parse(done.occurredAt) <= Date.parse(entry.occurredAt) + 24 * 60 * 60 * 1000)).length; }
  if (metricId === "tutor_helpfulness") { const rows = named("governed.tutor.feedback").filter((e) => typeof e.metadata.helpful === "boolean"); denominator = rows.length; numerator = rows.filter((e) => e.metadata.helpful === true).length; }
  if (metricId === "ai_grounding") { const rows = named("governed.ai.grounding_evaluated").filter((e) => typeof e.metadata.grounded === "boolean" && e.metadata.approvedContextAvailable === true && typeof e.metadata.evaluatorVersion === "string"); denominator = rows.length; numerator = rows.filter((e) => e.metadata.grounded === true).length; }
  if (metricId === "hallucination") { const rows = named("governed.ai.hallucination_evaluated").filter((e) => typeof e.metadata.unsupportedClaim === "boolean" && typeof e.metadata.evaluatorVersion === "string" && typeof e.metadata.category === "string"); denominator = rows.length; numerator = rows.filter((e) => e.metadata.unsupportedClaim === true).length; }
  if (metricId === "safety_decisions") { const decisions = new Set(named("governed.safety.decision").map((e) => String(e.metadata.interactionId))); const required = named("governed.safety.required"); denominator = required.length; numerator = required.filter((e) => decisions.has(String(e.metadata.interactionId))).length; }
  return { metricId, metricVersion: GOVERNED_METRIC_VERSION, numerator, denominator, value: denominator ? numerator / denominator : null, includedEventSchemaVersions: [GOVERNED_EVENT_SCHEMA_VERSION], excludedSyntheticEvents, missingDataEvents, quarantinedEvents: ingestion.quarantined.length, duplicateEvents: ingestion.duplicates, schoolId, window };
}
