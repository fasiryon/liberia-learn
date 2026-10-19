/**
 * Retention, transfer and lesson assessment blueprints (Curriculum Excellence Standard support).
 *
 * A scheduled delayed check is an evidence OPPORTUNITY, not proof of retention. Retention evidence
 * exists only when the learner independently completed the delayed item, the response passed the
 * applicable scoring authority, and enough time had passed since instruction. Transfer evidence
 * likewise needs a verified, independent response to an item authored in a NEW context. Delivering
 * a question proves nothing.
 *
 * There is no universal timetable. Intervals come from a versioned policy resolved for the grade
 * and subject; the 7/21-day proposal below is labelled PROPOSED and never auto-applies.
 */
import { LL_AEP_001_REF, LL_RETENTION_DEFAULT } from "@/lib/academic-policy/llAep001";
import type { AssessmentEvidenceEnvelope } from "./evidence";
import type { AssessmentItemV2, CognitiveDemand } from "./types";

export type RetentionSchedulePolicy = Readonly<{
  policyId: string;
  version: string;
  status: "PROPOSED" | "APPROVED";
  scope: Readonly<{ grade: number | null; subject: string | null }>;
  intervalsDays: readonly number[];
  /** Minimum days after instruction for a response to count as delayed. */
  minimumDelayDays: number;
  /** Documented exceptions: competencies for which these checks are unsuitable. */
  exceptions?: readonly RetentionException[];
}>;

export type RetentionException = Readonly<{
  objectiveId: string;
  reason: string;
  approvedBy: string;
}>;

/** Proposal from the Curriculum Excellence Standard; requires approval per grade/subject before use. */
export const PROPOSED_RETENTION_POLICY: RetentionSchedulePolicy = Object.freeze({
  policyId: "retention-proposal-7-21",
  version: "0.1.0",
  status: "PROPOSED",
  scope: { grade: null, subject: null },
  intervalsDays: [7, 21],
  minimumDelayDays: 7,
});

/**
 * LL-AEP-001 initial default: 7- and 21-day delayed checks for suitable taught competencies, with
 * documented exceptions. Approved as an institutional policy version; planning opportunities from it
 * activates nothing (no scheduler, delivery or evidence write is wired to it).
 */
export const LL_RETENTION_PILOT_POLICY: RetentionSchedulePolicy = Object.freeze({
  policyId: "ll-aep-001-retention-pilot",
  version: "1.0.0",
  status: "APPROVED",
  scope: { grade: null, subject: null },
  intervalsDays: [...LL_RETENTION_DEFAULT.intervalsDays],
  minimumDelayDays: LL_RETENTION_DEFAULT.minimumDelayDays,
  exceptions: [],
});

export const LL_RETENTION_POLICY_SOURCE = LL_AEP_001_REF;

export function validateRetentionPolicy(policy: RetentionSchedulePolicy): readonly string[] {
  const issues: string[] = [];
  if (policy.intervalsDays.length === 0 || policy.intervalsDays.some((days) => !Number.isInteger(days) || days < policy.minimumDelayDays)) issues.push("retention_intervals_invalid");
  for (const exception of policy.exceptions ?? []) {
    if (!exception.objectiveId || exception.reason.trim().length < 15 || !exception.approvedBy) issues.push(`retention_exception_undocumented:${exception.objectiveId}`);
  }
  return Object.freeze(issues);
}

/** Most specific APPROVED policy for (grade, subject); null when none is approved. */
export function resolveRetentionPolicy(policies: readonly RetentionSchedulePolicy[], grade: number, subject: string): RetentionSchedulePolicy | null {
  const approved = policies.filter((policy) => policy.status === "APPROVED"
    && (policy.scope.grade === null || policy.scope.grade === grade)
    && (policy.scope.subject === null || policy.scope.subject === subject));
  const specificity = (policy: RetentionSchedulePolicy) => (policy.scope.grade === null ? 0 : 2) + (policy.scope.subject === null ? 0 : 1);
  return [...approved].sort((a, b) => specificity(b) - specificity(a))[0] ?? null;
}

export type EvidenceOpportunity = Readonly<{
  opportunityId: string;
  kind: "DELAYED_RETENTION";
  studentId: string;
  objectiveIds: readonly string[];
  instructionCompletedAt: string;
  dueAt: string;
  intervalDays: number;
  policyRef: string;
  /** Always false: an opportunity is never evidence. */
  isEvidence: false;
}>;

const DAY_MS = 86_400_000;

export function planRetentionOpportunities(input: {
  studentId: string;
  objectiveIds: readonly string[];
  instructionCompletedAt: string;
  policy: RetentionSchedulePolicy | null;
}): readonly EvidenceOpportunity[] {
  if (!input.policy || input.policy.status !== "APPROVED") return Object.freeze([]);
  if (validateRetentionPolicy(input.policy).length > 0) throw new Error("assessment_retention_policy_invalid");
  const excepted = new Set((input.policy.exceptions ?? []).map((exception) => exception.objectiveId));
  const objectiveIds = input.objectiveIds.filter((objectiveId) => !excepted.has(objectiveId));
  if (objectiveIds.length === 0) return Object.freeze([]);
  const start = Date.parse(input.instructionCompletedAt);
  if (!Number.isFinite(start)) throw new Error("assessment_instruction_timestamp_invalid");
  const policy = input.policy;
  return Object.freeze(policy.intervalsDays.map((intervalDays) => Object.freeze({
    opportunityId: `${input.studentId}:${[...objectiveIds].sort().join("+")}:${intervalDays}d`,
    kind: "DELAYED_RETENTION" as const,
    studentId: input.studentId,
    objectiveIds: [...objectiveIds],
    instructionCompletedAt: input.instructionCompletedAt,
    dueAt: new Date(start + intervalDays * DAY_MS).toISOString(),
    intervalDays,
    policyRef: `${policy.policyId}@${policy.version}`,
    isEvidence: false as const,
  })));
}

export type RetentionClassification =
  | Readonly<{ kind: "RETENTION_EVIDENCE"; evidenceId: string; delayDays: number }>
  | Readonly<{ kind: "NOT_RETENTION_EVIDENCE"; reason: string }>;

const VERIFIED_TIERS = new Set(["VERIFIED_ASSESSMENT_EVIDENCE", "MASTERY_ADMITTED_EVIDENCE"]);

export function classifyRetentionEvidence(opportunity: EvidenceOpportunity, evidence: AssessmentEvidenceEnvelope | null, policy: RetentionSchedulePolicy): RetentionClassification {
  const not = (reason: string) => Object.freeze({ kind: "NOT_RETENTION_EVIDENCE" as const, reason });
  if (!evidence) return not("opportunity_not_completed");
  if (evidence.scope.studentId !== opportunity.studentId) return not("different_student");
  if (!VERIFIED_TIERS.has(evidence.tier)) return not(evidence.tier === "RAW_OBSERVATION" ? "response_not_verified" : "provisional_feedback_is_not_evidence");
  if (evidence.delivery.purpose !== "RETENTION") return not("item_not_delivered_as_retention_check");
  if (evidence.independence !== "INDEPENDENT") return not("assisted_response");
  if (!evidence.objectiveIds.some((objectiveId) => opportunity.objectiveIds.includes(objectiveId))) return not("objective_mismatch");
  const delayDays = (Date.parse(evidence.occurredAt) - Date.parse(opportunity.instructionCompletedAt)) / DAY_MS;
  if (!(delayDays >= policy.minimumDelayDays)) return not("insufficient_delay");
  return Object.freeze({ kind: "RETENTION_EVIDENCE" as const, evidenceId: evidence.evidenceId, delayDays: Math.floor(delayDays) });
}

export function classifyTransferEvidence(evidence: AssessmentEvidenceEnvelope | null, item: AssessmentItemV2): Readonly<{ transfer: boolean; reason: string }> {
  if (!evidence) return Object.freeze({ transfer: false, reason: "no_response" });
  if (evidence.pins.itemId !== item.itemId || evidence.pins.itemHash !== item.itemHash) return Object.freeze({ transfer: false, reason: "item_mismatch" });
  if (item.context !== "NEW") return Object.freeze({ transfer: false, reason: "item_context_not_new" });
  if (!VERIFIED_TIERS.has(evidence.tier)) return Object.freeze({ transfer: false, reason: "response_not_verified" });
  if (evidence.independence !== "INDEPENDENT") return Object.freeze({ transfer: false, reason: "assisted_response" });
  return Object.freeze({ transfer: true, reason: "verified_independent_new_context" });
}

// ─── Lesson assessment blueprint ────────────────────────────────────────────────────────────────

export type BlueprintSlot =
  | "PREREQUISITE_DIAGNOSTIC"
  | "END_OF_LESSON_INDEPENDENT"
  | "DELAYED_RETENTION"
  | "TRANSFER"
  | "HIGHER_ORDER"
  | "ORIGINAL_WRITING_OR_PERFORMANCE";

export type BlueprintEntry = Readonly<{
  slot: BlueprintSlot;
  itemId: string;
  itemVersion: string;
  objectiveIds: readonly string[];
  /** Remediation route bound to misconceptions this item can detect. */
  misconceptionRemediation: readonly Readonly<{ misconceptionId: string; remediationRef: string }>[];
}>;

export type LessonAssessmentBlueprint = Readonly<{
  lessonId: string;
  lessonVersion: string;
  objectiveIds: readonly string[];
  prerequisiteObjectiveIds: readonly string[];
  /** Whether the lesson's outcomes call for original writing or a performance task. */
  requiresOriginalProduct: boolean;
  entries: readonly BlueprintEntry[];
  retentionPolicyRef: string | null;
}>;

const HIGHER_ORDER: readonly CognitiveDemand[] = ["ANALYZE", "EVALUATE", "CREATE"];

/**
 * Coverage gaps against the standard: a diagnostic per prerequisite, an independent end-of-lesson
 * item per objective, a delayed retention item, a transfer item in a NEW context, a higher-order
 * item, an original product when the outcomes call for one, and remediation for every
 * misconception an item is mapped to. Reports gaps; it never certifies the lesson effective.
 */
export function blueprintGaps(blueprint: LessonAssessmentBlueprint, items: ReadonlyMap<string, AssessmentItemV2>): readonly string[] {
  const gaps: string[] = [];
  const bySlot = (slot: BlueprintSlot) => blueprint.entries.filter((entry) => entry.slot === slot);
  const resolve = (entry: BlueprintEntry) => items.get(`${entry.itemId}@${entry.itemVersion}`);
  for (const objectiveId of blueprint.prerequisiteObjectiveIds) {
    if (!bySlot("PREREQUISITE_DIAGNOSTIC").some((entry) => entry.objectiveIds.includes(objectiveId))) gaps.push(`prerequisite_diagnostic_missing:${objectiveId}`);
  }
  for (const objectiveId of blueprint.objectiveIds) {
    if (!bySlot("END_OF_LESSON_INDEPENDENT").some((entry) => entry.objectiveIds.includes(objectiveId))) gaps.push(`independent_check_missing:${objectiveId}`);
  }
  if (bySlot("DELAYED_RETENTION").length === 0) gaps.push("delayed_retention_missing");
  if (bySlot("DELAYED_RETENTION").length > 0 && !blueprint.retentionPolicyRef) gaps.push("retention_policy_unresolved");
  const transfer = bySlot("TRANSFER");
  if (transfer.length === 0) gaps.push("transfer_missing");
  for (const entry of transfer) if (resolve(entry)?.context !== "NEW") gaps.push(`transfer_item_not_new_context:${entry.itemId}`);
  if (!bySlot("HIGHER_ORDER").some((entry) => HIGHER_ORDER.includes(resolve(entry)?.cognitiveDemand ?? "RECALL"))) gaps.push("higher_order_missing");
  if (blueprint.requiresOriginalProduct && bySlot("ORIGINAL_WRITING_OR_PERFORMANCE").length === 0) gaps.push("original_product_missing");
  for (const entry of blueprint.entries) {
    const item = resolve(entry);
    if (!item) {
      gaps.push(`item_unresolved:${entry.itemId}@${entry.itemVersion}`);
      continue;
    }
    for (const misconceptionId of item.misconceptionIds) {
      if (!entry.misconceptionRemediation.some((route) => route.misconceptionId === misconceptionId)) gaps.push(`remediation_missing:${entry.itemId}:${misconceptionId}`);
    }
  }
  return Object.freeze(gaps);
}
